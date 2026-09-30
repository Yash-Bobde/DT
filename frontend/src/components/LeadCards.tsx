"use client";

import type { Lead } from "@/lib/types";
import {
  CautionChip,
  Empty,
  Monogram,
  ScoreRing,
  ScoreShape,
  Skeleton,
  TierBadge,
} from "./Atoms";

/** Card-grid view of the leads — the premium, scannable alternative to the dense
 *  table. Each card carries a company monogram, a circular score ring, the fit
 *  shape, a one-line reason, and the top decision-maker. */
export function LeadCards({
  leads,
  loading,
  onSelect,
  selectedId,
  filtersActive,
}: {
  leads: Lead[];
  loading: boolean;
  onSelect: (lead: Lead) => void;
  selectedId?: string;
  filtersActive: boolean;
}) {
  if (loading) return <Skeleton rows={8} />;
  if (!leads.length) {
    return (
      <Empty
        title={filtersActive ? "No leads match these filters" : "No leads yet"}
        hint={
          filtersActive
            ? "Widen the score range, clear the event filter, or include lower tiers."
            : "Run lead discovery from the top bar. A cached run replays the committed snapshot in seconds."
        }
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(304px, 1fr))",
        }}
      >
        {leads.map((lead) => {
          const contact = lead.contacts[0];
          const selected = lead.company_id === selectedId;
          const why = (lead.rationale ?? "").split(". ")[0];
          const size = lead.revenue_band ?? lead.employee_band;
          return (
            <button
              key={lead.company_id}
              type="button"
              onClick={() => onSelect(lead)}
              className="lead-card"
              style={{
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 11,
                padding: 15,
                borderRadius: 13,
                background: "var(--c-surface)",
                border: `1px solid ${selected ? "var(--accent-line)" : "var(--c-hairline)"}`,
                boxShadow: selected ? "0 0 0 1px var(--accent-line)" : undefined,
              }}
            >
              {/* Head: identity + score ring */}
              <div className="flex items-start gap-3">
                <Monogram name={lead.company_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lead.company_name}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--c-t3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lead.domain ?? "no domain"}
                  </div>
                </div>
                <ScoreRing value={lead.score_total} />
              </div>

              {/* Tier + fit shape + size */}
              <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                <TierBadge tier={lead.tier} />
                <ScoreShape score={lead.score} height={14} />
                <span style={{ flex: 1 }} />
                {size ? (
                  <span className="tabular mono" style={{ fontSize: 11, color: "var(--c-t3)" }}>
                    {size}
                  </span>
                ) : (
                  <CautionChip title="No public size figure was found; this costs confidence rather than being guessed">
                    unknown
                  </CautionChip>
                )}
              </div>

              {/* Why */}
              {why ? (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "var(--c-t2)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 36,
                  }}
                >
                  {why}.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--c-t3)", minHeight: 36 }}>
                  {lead.industry ?? "—"}
                </div>
              )}

              {/* Foot: top contact */}
              <div
                className="flex items-center gap-2"
                style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--c-hairline)" }}
              >
                {contact ? (
                  <>
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: contact.provider === "mock" ? "var(--c-caution)" : "var(--c-good)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
                      {contact.full_name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--c-t3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={contact.title ?? undefined}
                    >
                      {contact.title}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--c-t3)", fontStyle: "italic" }}>
                    no contact found
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
