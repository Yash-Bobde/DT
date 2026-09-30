"""OpenAI-backed LLMClient.

An isolated adapter so the pipeline can run live on an OpenAI key. The Anthropic
`LLMClient` (`client.py`) is the reference implementation and stays untouched;
this subclass overrides only the *transport* — how a client is built, how one
schema-constrained call is made, and how provider errors and pricing are
handled. Everything else is inherited: the single repair round-trip, the
Pydantic validation gate, and the degrade-don't-crash contract. The model still
only does fuzzy work; swapping the provider does not move any decision out of
deterministic code.
"""

from __future__ import annotations

import logging

from ...config import get_settings
from .client import MAX_TOKENS, MODEL_PRICING, LLMClient, LLMOutputError, LLMUnavailable, Usage

logger = logging.getLogger(__name__)

# USD per million tokens, input / output. Billing is OpenAI's; this only puts a
# number on a run. Registered into the shared pricing table so the inherited
# `Usage.estimated_usd` can price OpenAI models without editing client.py.
_OPENAI_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
}
MODEL_PRICING.update(_OPENAI_PRICING)

# JSON-Schema keywords OpenAI's strict structured-output mode rejects outright.
# Anthropic tolerates them and Pydantic can emit them, so a schema that validates
# against one provider can 400 against the other. Strip them defensively; none
# carries information the model needs to fill the fields correctly.
_UNSUPPORTED_SCHEMA_KEYS = frozenset(
    {
        "title",
        "default",
        "examples",
        "format",
        "pattern",
        "minLength",
        "maxLength",
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minItems",
        "maxItems",
        "uniqueItems",
    }
)


def _to_strict_schema(node: object) -> object:
    """Rewrite a Pydantic JSON schema into one OpenAI strict mode accepts.

    Two transforms, applied to every node:

    1. Drop the keywords strict mode rejects (`_UNSUPPORTED_SCHEMA_KEYS`).
    2. Force every object to declare `additionalProperties: false` and to list
       *all* of its properties in `required`. Pydantic leaves fields that carry a
       default out of `required` — a list field with `default_factory=list`, for
       instance — which the Anthropic path tolerates but OpenAI 400s on
       ("required must include every key in properties"). Nullable fields stay
       expressible: they are required *and* accept null via their anyOf branch.
    """
    if isinstance(node, dict):
        out = {
            key: _to_strict_schema(value)
            for key, value in node.items()
            if key not in _UNSUPPORTED_SCHEMA_KEYS
        }
        if out.get("type") == "object" and "properties" in out:
            out["additionalProperties"] = False
            out["required"] = list(out["properties"].keys())
        return out
    if isinstance(node, list):
        return [_to_strict_schema(item) for item in node]
    return node


class OpenAILLMClient(LLMClient):
    """LLMClient that talks to OpenAI's chat-completions structured-output API."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.openai_api_key
        # The OpenAI SDK reads OPENAI_BASE_URL from the environment on its own;
        # only an explicit override is threaded through here.
        self._base_url = base_url
        self.model_reasoning = settings.llm_model_reasoning
        self.model_extraction = settings.llm_model_extraction
        self._max_spend_usd = settings.llm_max_spend_usd
        self._client = None
        self.usage = Usage()

    def _openai(self):
        if self._client is None:
            if not self._api_key:
                raise LLMUnavailable("OPENAI_API_KEY is not set")
            import openai  # lazy: offline/cached runs never import the SDK

            kwargs: dict[str, object] = {"api_key": self._api_key, "max_retries": 3}
            if self._base_url:
                kwargs["base_url"] = self._base_url
            self._client = openai.OpenAI(**kwargs)
        return self._client

    # -- transport (the only thing this subclass changes) ----------------

    def _complete_json(self, *, model: str, system: str, prompt: str, schema: dict) -> str:
        # Hard spend cap. A live run with gpt-4o-mini costs cents, but a pricing
        # surprise or a runaway loop must never bill past the budget: once the
        # running estimate crosses the cap, degrade exactly like a provider
        # outage so the deterministic path takes over for the rest of the run.
        if self._max_spend_usd and self.usage.estimated_usd >= self._max_spend_usd:
            raise LLMUnavailable(
                f"spend cap ${self._max_spend_usd:.2f} reached "
                f"(estimated ${self.usage.estimated_usd:.4f}); "
                "degrading to deterministic output"
            )

        client = self._openai()
        strict_schema = _to_strict_schema(schema)
        name = "".join(c for c in (schema.get("title") or "response") if c.isalnum() or c in "_-")
        name = name[:60] or "response"

        try:
            response = client.chat.completions.create(
                model=model,
                max_tokens=MAX_TOKENS,
                temperature=0,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": name, "schema": strict_schema, "strict": True},
                },
            )
        except Exception as exc:  # noqa: BLE001 -- re-raised as a typed failure below
            # An exhausted balance, a revoked key or a rate limit arrives as an
            # SDK exception the pipeline has never heard of. The base class's
            # _guarded() only recognises the anthropic/httpx modules, so OpenAI
            # errors are converted here: provider problems are an availability
            # condition, not a bug. Our own TypeError still propagates.
            module = type(exc).__module__ or ""
            if module.startswith("openai") or module.startswith("httpx"):
                raise LLMUnavailable(f"{type(exc).__name__}: {exc}"[:300]) from exc
            raise

        choice = response.choices[0]
        if getattr(choice.message, "refusal", None):
            raise LLMOutputError(f"model refused to answer: {choice.message.refusal}"[:300])

        usage = getattr(response, "usage", None)
        self.usage.record(
            model,
            getattr(usage, "prompt_tokens", 0) or 0,
            getattr(usage, "completion_tokens", 0) or 0,
        )
        return choice.message.content or ""
