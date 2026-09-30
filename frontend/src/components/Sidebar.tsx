"use client";

import type { ReactNode } from "react";
import type { Summary } from "@/lib/types";

export type Tab = "leads" | "outreach" | "events" | "agents" | "errors";

type NavItem = { id: Tab; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { id: "leads", label: "Leads", icon: <LeadsIcon /> },
  { id: "outreach", label: "Outreach", icon: <OutreachIcon /> },
  { id: "events", label: "Events", icon: <EventsIcon /> },
  { id: "agents", label: "Agents", icon: <AgentsIcon /> },
  { id: "errors", label: "Errors", icon: <ErrorsIcon /> },
];

export function Sidebar({
  tab,
  onTab,
  counts,
  summary,
  dark,
  onToggleTheme,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Record<Tab, number>;
  summary: Summary | null;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <aside
      className="flex flex-col"
      style={{
        width: 216,
        flexShrink: 0,
        background: "var(--c-surface)",
        borderRight: "1px solid var(--c-hairline)",
        height: "100vh",
      }}
    >
      {/* Wordmark */}
      <div
        className="flex items-center gap-2.5"
        style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--c-hairline)" }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent)",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.4" stroke="var(--accent-fg)" strokeWidth="1.5" />
            <path d="M4 7h6M7 4v6" stroke="var(--accent-fg)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            Tedlar Agent
          </div>
          <div style={{ fontSize: 9.5, color: "var(--c-t3)", lineHeight: 1.3 }}>
            Graphics &amp; Signage
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col" style={{ padding: 8, gap: 2, flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: "var(--c-t3)",
            padding: "6px 8px 4px",
          }}
        >
          Pipeline output
        </div>
        {NAV.map((item) => {
          const active = tab === item.id;
          const count = counts[item.id];
          const warn = item.id === "errors" && count > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className="flex items-center gap-2.5"
              style={{
                position: "relative",
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--c-t1)" : "var(--c-t2)",
                background: active ? "var(--c-raised)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--c-raised)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 3,
                    background: "var(--accent)",
                  }}
                />
              )}
              <span
                style={{
                  display: "inline-flex",
                  color: active ? "var(--accent)" : "var(--c-t3)",
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span
                className="tabular"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  padding: "1px 6px",
                  borderRadius: 10,
                  color: warn ? "var(--c-caution)" : active ? "var(--c-t2)" : "var(--c-t3)",
                  background: warn
                    ? "color-mix(in srgb, var(--c-caution) 14%, transparent)"
                    : "var(--c-raised)",
                  border: `1px solid ${
                    warn ? "color-mix(in srgb, var(--c-caution) 26%, transparent)" : "var(--c-hairline)"
                  }`,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div
        style={{
          borderTop: "1px solid var(--c-hairline)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        <div className="flex items-center gap-1.5" style={{ fontSize: 10.5, color: "var(--c-t3)" }}>
          <span
            aria-hidden
            className={summary?.llm_enabled ? "live-dot" : undefined}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: summary?.llm_enabled ? "var(--c-good)" : "var(--c-t3)",
              flexShrink: 0,
            }}
          />
          {summary?.llm_enabled ? "LLM online" : "LLM offline"}
          {summary?.search_provider && (
            <span className="mono" style={{ marginLeft: "auto", color: "var(--c-t3)" }}>
              {summary.search_provider}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center gap-2"
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--c-hairline)",
            background: "var(--c-raised)",
            color: "var(--c-t2)",
            cursor: "pointer",
            fontSize: 11.5,
          }}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </aside>
  );
}

/* ── Icons (14px, currentColor) ──────────────────────────────────────────── */
function LeadsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function OutreachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 5l5 3.5L13 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function EventsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 6h11M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function AgentsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 1.5v2M9.5 1.5v2M6.5 12.5v2M9.5 12.5v2M1.5 6.5h2M1.5 9.5h2M12.5 6.5h2M12.5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function ErrorsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.2 14.8 13.4H1.2L8 2.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 6.4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.1" r="0.7" fill="currentColor" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l1.41-1.41M3.05 12.95l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13 8.5A5.5 5.5 0 0 1 7.5 3C5 3 3 5 3 7.5A5.5 5.5 0 0 0 8.5 13C11 13 13 11 13 8.5Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
