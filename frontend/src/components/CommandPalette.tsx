"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import type { Tab } from "./Sidebar";
import { Kbd } from "./Atoms";

type Command = { id: string; label: string; group: string; perform: () => void };

/** ⌘K command palette. No dependency — a filtered action list plus jump-to-lead,
 *  with arrow/enter/escape navigation and focus on the input while open. */
export function CommandPalette({
  onClose,
  onTab,
  onRun,
  onToggleTheme,
  onFocusSearch,
  leads,
  onSelectLead,
}: {
  onClose: () => void;
  onTab: (t: Tab) => void;
  onRun: (mode: string) => void;
  onToggleTheme: () => void;
  onFocusSearch: () => void;
  leads: Lead[];
  onSelectLead: (companyId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const run = (fn: () => void) => () => {
      fn();
      onClose();
    };
    const views: { id: Tab; label: string }[] = [
      { id: "leads", label: "Leads" },
      { id: "outreach", label: "Outreach" },
      { id: "events", label: "Events" },
      { id: "agents", label: "Agents" },
      { id: "errors", label: "Errors" },
    ];
    const base: Command[] = [
      ...views.map((v) => ({
        id: `go-${v.id}`,
        label: `Go to ${v.label}`,
        group: "Navigate",
        perform: run(() => onTab(v.id)),
      })),
      { id: "search", label: "Search leads…", group: "Navigate", perform: run(onFocusSearch) },
      { id: "run-cached", label: "Run cached discovery", group: "Run", perform: run(() => onRun("cached")) },
      { id: "run-live", label: "Run live discovery", group: "Run", perform: run(() => onRun("live")) },
      { id: "theme", label: "Toggle light / dark", group: "View", perform: run(onToggleTheme) },
    ];
    const leadCmds: Command[] = leads.slice(0, 60).map((l) => ({
      id: `lead-${l.company_id}`,
      label: l.company_name,
      group: "Open lead",
      perform: run(() => {
        onTab("leads");
        onSelectLead(l.company_id);
      }),
    }));
    return [...base, ...leadCmds];
  }, [leads, onTab, onRun, onToggleTheme, onFocusSearch, onSelectLead, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // The palette is mounted only while open, so focusing on mount is enough — no
  // reset effect needed, which also keeps setState out of effect bodies.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // Keep the active row in view (DOM sync only, no state).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.perform();
    }
  }

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: "min(560px, 92vw)",
          background: "var(--c-overlay)",
          border: "1px solid var(--c-hairline-strong)",
          borderRadius: 12,
          boxShadow: "var(--shadow-overlay)",
          overflow: "hidden",
          animation: "riseIn 0.12s ease-out",
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{ padding: "12px 14px", borderBottom: "1px solid var(--c-hairline)" }}
        >
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Type a command or a company…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--c-t1)",
              fontSize: 14,
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: "48vh", overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--c-t3)", fontSize: 12.5 }}>
              No matches
            </div>
          ) : (
            filtered.map((c, i) => {
              const isActive = i === active;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => c.perform()}
                  className="flex items-center gap-2"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--c-raised)" : "transparent",
                    color: "var(--c-t1)",
                    fontSize: 13,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: isActive ? "var(--accent)" : "var(--c-t3)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--c-t3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {c.group}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div
          className="flex items-center gap-3"
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--c-hairline)",
            fontSize: 10.5,
            color: "var(--c-t3)",
          }}
        >
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> select
          </span>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: "var(--c-t3)" }}>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
