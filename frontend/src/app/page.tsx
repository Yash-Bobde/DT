"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ApiError, api } from "@/lib/api";
import type {
  AgentOut,
  EventOut,
  Lead,
  OutreachOut,
  RunOut,
  StageErrorOut,
  Summary,
  Tier,
} from "@/lib/types";
import { Button, Kbd, WarnIcon } from "@/components/Atoms";
import { ErrorsTab } from "@/components/ErrorsTab";
import { EventsTab } from "@/components/EventsTab";
import { LeadDrawer } from "@/components/LeadDrawer";
import { LeadTable } from "@/components/LeadTable";
import { LeadCards } from "@/components/LeadCards";
import { OutreachTab } from "@/components/OutreachTab";
import { MetricTiles, RunEconomicsBar } from "@/components/MetricTiles";
import { AgentsTab } from "@/components/AgentsTab";
import { PipelineStrip } from "@/components/PipelineStrip";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";

/* Theme store: <html class="dark"> is the single source of truth, set before
   paint by the bootstrap script and flipped by the toggle. */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");
const isDarkOnServer = () => true;

const TIER_FILTERS: { value: Tier; label: string; color: string }[] = [
  { value: "A", label: "A · Priority", color: "var(--c-good)" },
  { value: "B", label: "B · Qualified", color: "var(--c-score-1)" },
  { value: "C", label: "C · Watch", color: "var(--c-warning)" },
  { value: "disqualified", label: "Out of ICP", color: "var(--c-t3)" },
];

const VIEW_TITLE: Record<Tab, string> = {
  leads: "Leads",
  outreach: "Outreach",
  events: "Events & associations",
  agents: "Agents",
  errors: "Handled errors",
};

export default function Dashboard() {
  const dark = useSyncExternalStore(subscribeToTheme, isDark, isDarkOnServer);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<EventOut[]>([]);
  const [agents, setAgents] = useState<AgentOut[]>([]);
  const [errors, setErrors] = useState<StageErrorOut[]>([]);
  const [run, setRun] = useState<RunOut | null>(null);

  const [tab, setTab] = useState<Tab>("leads");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leadView, setLeadView] = useState<"cards" | "table">("cards");

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [eventId, setEventId] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("cached");
  const [starting, setStarting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("tedlar-theme", next ? "dark" : "light");
    } catch {
      /* private windows can refuse storage; the toggle still works this session */
    }
  }

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    try {
      const [s, l, e, err, runs, ag] = await Promise.all([
        api.summary(),
        api.leads({
          tier: tiers.length ? tiers : undefined,
          event_id: eventId || undefined,
          min_score: minScore || undefined,
          q: query || undefined,
        }),
        api.events(),
        api.errors(),
        api.runs(),
        api.agents(),
      ]);
      if (isStale()) return;
      setSummary(s);
      setLeads(l);
      setEvents(e);
      setErrors(err);
      setRun(runs[0] ?? null);
      setAgents(ag);
      setApiError(null);
    } catch (e) {
      if (isStale()) return;
      setApiError(e instanceof ApiError ? e.message : "Unexpected error loading data");
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [tiers, eventId, minScore, query]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  /* Poll only while a run is active, then refresh once it settles. */
  useEffect(() => {
    if (run?.status !== "running") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const id = run.id;
    pollRef.current = setInterval(async () => {
      try {
        const latest = await api.run(id);
        setRun(latest);
        if (latest.status !== "running") void load();
      } catch {
        /* a dropped poll retries on the next tick */
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [run?.status, run?.id, load]);

  /* ⌘K / Ctrl-K opens the command palette. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(
    () => leads.find((lead) => lead.company_id === selectedId),
    [leads, selectedId],
  );

  const running = run?.status === "running";
  const filtersActive = Boolean(tiers.length || eventId || minScore || query);

  const counts = useMemo<Record<Tab, number>>(
    () => ({
      leads: leads.length,
      outreach: leads.reduce((n, l) => n + l.outreach.length, 0),
      events: events.length,
      agents: agents.length,
      errors: errors.length,
    }),
    [leads, events, agents, errors],
  );

  const focusSearch = useCallback(() => {
    setTab("leads");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  async function startRun(runMode: string = mode) {
    setStarting(true);
    try {
      setRun(await api.startRun(runMode));
      setApiError(null);
    } catch (e) {
      setApiError(e instanceof ApiError ? e.message : "Could not start the run");
    } finally {
      setStarting(false);
    }
  }

  function applyOutreach(updated: OutreachOut) {
    setLeads((current) =>
      current.map((lead) => ({
        ...lead,
        outreach: lead.outreach.map((d) => (d.id === updated.id ? updated : d)),
      })),
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--c-page)", color: "var(--c-t1)" }}>
      <Sidebar
        tab={tab}
        onTab={setTab}
        counts={counts}
        summary={summary}
        dark={dark}
        onToggleTheme={toggleTheme}
      />

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        {apiError && (
          <div
            className="flex items-center gap-2"
            style={{
              background: "var(--c-critical)",
              color: "#fff",
              padding: "7px 20px",
              fontSize: 12,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            <WarnIcon size={12} />
            {apiError}
            <button
              onClick={() => void load()}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid rgba(255,255,255,.5)",
                borderRadius: 4,
                color: "#fff",
                cursor: "pointer",
                fontSize: 11,
                padding: "2px 8px",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Command bar */}
        <header
          className="flex items-center gap-3"
          style={{
            background: "var(--c-surface)",
            borderBottom: "1px solid var(--c-hairline)",
            padding: "0 18px",
            height: 52,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {VIEW_TITLE[tab]}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2"
            title="Command palette"
            style={{
              padding: "5px 10px",
              borderRadius: 7,
              border: "1px solid var(--c-hairline)",
              background: "var(--c-raised)",
              color: "var(--c-t3)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Search
            <Kbd>⌘K</Kbd>
          </button>

          {running && (
            <span
              className="flex items-center gap-2"
              style={{
                padding: "4px 10px",
                borderRadius: 7,
                fontSize: 11.5,
                color: "var(--accent)",
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid var(--accent-line)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="18 8" />
              </svg>
              <span className="mono">{run?.current_stage ?? "running"}</span>
            </span>
          )}

          <label className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: "var(--c-t2)" }}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              title="Cached replays the committed snapshot; live re-fetches every source."
              style={{
                padding: "5px 8px",
                fontSize: 11.5,
                borderRadius: 6,
                background: "var(--c-raised)",
                border: "1px solid var(--c-hairline)",
                color: "var(--c-t1)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="cached">Cached run</option>
              <option value="live">Live run</option>
            </select>
          </label>

          <Button variant="accent" onClick={() => startRun()} disabled={starting || running}>
            {running ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="18 8" />
                </svg>
                Running…
              </>
            ) : starting ? (
              "Starting…"
            ) : (
              "Run discovery"
            )}
          </Button>
        </header>

        <PipelineStrip run={run} summary={summary} />
        <MetricTiles summary={summary} />
        <RunEconomicsBar summary={summary} />

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {tab === "leads" && (
            <>
              <div
                className="flex flex-wrap items-center gap-2"
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--c-hairline)",
                  background: "var(--c-surface)",
                  flexShrink: 0,
                }}
              >
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, domain, industry, product…"
                  style={{
                    flex: "1 1 220px",
                    minWidth: 200,
                    padding: "6px 10px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid var(--c-hairline)",
                    background: "var(--c-raised)",
                    color: "var(--c-t1)",
                    outline: "none",
                  }}
                />
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    fontSize: 11.5,
                    borderRadius: 6,
                    border: "1px solid var(--c-hairline)",
                    background: "var(--c-raised)",
                    color: "var(--c-t1)",
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: 230,
                  }}
                >
                  <option value="">All events</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2" style={{ fontSize: 11.5, color: "var(--c-t2)" }}>
                  Min score
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    style={{ width: 84 }}
                  />
                  <span className="tabular mono" style={{ width: 22, color: "var(--c-t1)" }}>
                    {minScore || "off"}
                  </span>
                </label>

                <a
                  href={api.leadsCsvUrl({
                    tier: tiers.length ? tiers : undefined,
                    min_score: minScore || undefined,
                  })}
                  title="Export the current tier and score filters as CSV"
                  style={{
                    padding: "5px 10px",
                    fontSize: 11.5,
                    borderRadius: 6,
                    border: "1px solid var(--c-hairline)",
                    background: "var(--c-raised)",
                    color: "var(--c-t1)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Export CSV
                </a>

                <div className="flex flex-wrap gap-1">
                  {TIER_FILTERS.map((filter) => {
                    const active = tiers.includes(filter.value);
                    return (
                      <button
                        key={filter.value}
                        onClick={() =>
                          setTiers((current) =>
                            active
                              ? current.filter((t) => t !== filter.value)
                              : [...current, filter.value],
                          )
                        }
                        style={{
                          padding: "4px 9px",
                          fontSize: 11,
                          borderRadius: 6,
                          cursor: "pointer",
                          color: active ? filter.color : "var(--c-t2)",
                          background: active
                            ? `color-mix(in srgb, ${filter.color} 12%, transparent)`
                            : "var(--c-raised)",
                          border: `1px solid ${
                            active
                              ? `color-mix(in srgb, ${filter.color} 30%, transparent)`
                              : "var(--c-hairline)"
                          }`,
                        }}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="flex"
                  style={{
                    marginLeft: "auto",
                    background: "var(--c-raised)",
                    border: "1px solid var(--c-hairline)",
                    borderRadius: 7,
                    padding: 2,
                    gap: 2,
                  }}
                >
                  {(["cards", "table"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setLeadView(v)}
                      style={{
                        padding: "3px 11px",
                        fontSize: 11,
                        borderRadius: 5,
                        cursor: "pointer",
                        border: "none",
                        textTransform: "capitalize",
                        color: leadView === v ? "var(--c-t1)" : "var(--c-t3)",
                        background: leadView === v ? "var(--c-surface)" : "transparent",
                        fontWeight: leadView === v ? 600 : 500,
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {leadView === "cards" ? (
                <LeadCards
                  leads={leads}
                  loading={loading}
                  selectedId={selectedId}
                  filtersActive={filtersActive}
                  onSelect={(lead) => setSelectedId(lead.company_id)}
                />
              ) : (
                <LeadTable
                  leads={leads}
                  loading={loading}
                  selectedId={selectedId}
                  filtersActive={filtersActive}
                  onSelect={(lead) => setSelectedId(lead.company_id)}
                />
              )}
            </>
          )}

          {tab === "outreach" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <OutreachTab leads={leads} loading={loading} onOutreachChange={applyOutreach} />
            </div>
          )}
          {tab === "events" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <EventsTab events={events} loading={loading} />
            </div>
          )}
          {tab === "agents" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <AgentsTab agents={agents} loading={loading} />
            </div>
          )}
          {tab === "errors" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ErrorsTab errors={errors} loading={loading} />
            </div>
          )}
        </div>
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelectedId(undefined)}
          onOutreachChange={applyOutreach}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onTab={setTab}
          onRun={(m) => startRun(m)}
          onToggleTheme={toggleTheme}
          onFocusSearch={focusSearch}
          leads={leads}
          onSelectLead={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
