from .client import LLMClient, LLMOutputError, LLMUnavailable, Usage


def make_llm_client(**kwargs) -> LLMClient:
    """Return the LLM client for the configured provider.

    The whole point of the abstraction: every call site builds its client
    through here, so selecting OpenAI is one env var (``LLM_PROVIDER=openai``)
    and never a code change at the call site. Defaults to the Anthropic path,
    which keeps existing behaviour — and the hermetic test suite — unchanged.
    """
    from ...config import get_settings

    provider = (get_settings().llm_provider or "anthropic").strip().lower()
    if provider == "openai":
        from .openai_client import OpenAILLMClient

        return OpenAILLMClient(**kwargs)
    return LLMClient(**kwargs)


__all__ = ["LLMClient", "LLMOutputError", "LLMUnavailable", "Usage", "make_llm_client"]
