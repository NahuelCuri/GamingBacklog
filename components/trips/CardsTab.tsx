"use client";

// Cards tab: search, type filters and a grid of every card in the trip. In
// compare mode a tap adds or removes the card from the compare drawer.
import { useState, type KeyboardEvent } from "react";
import { matchesSearch, matchesType, money, statusMeta, typeFilterOptions, typeMeta } from "@/lib/trips/model";
import { toggleInCompare } from "./CompareDrawer";
import { FxPanel } from "./FxPanel";
import { T, filterPill, frame, input, pulse, statusDot, typeTag } from "./styles";
import { useTripCtx } from "./TripPlanner";

export function CardsTab() {
  const { trip, cards, poolFilter, setPoolFilter, compare, setCompare, openCard, openEdit, newCard } = useTripCtx();
  const [search, setSearch] = useState("");
  const [fxOpen, setFxOpen] = useState(false);
  const shown = cards.filter((c) => matchesType(c, poolFilter) && matchesSearch(c, search));
  const open = (id: string) => (compare.on ? setCompare((c) => toggleInCompare(c, id)) : openCard(id));

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: T.bg }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px 100px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cards"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search cards — title, tag or place…"
            style={{ ...input, flex: 1, minWidth: 220, background: T.panel, borderRadius: 10, padding: "11px 14px", fontSize: 13.5 }}
          />
          <button
            type="button"
            onClick={() => setFxOpen((o) => !o)}
            title="Currency converter"
            aria-expanded={fxOpen}
            style={{
              cursor: "pointer", flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, padding: "11px 14px", borderRadius: 10, transition: "color .15s,border-color .15s",
              ...(fxOpen ? { background: "rgba(95,184,176,.14)", color: "#7fe3d8", border: "1px solid #3a6b66" } : { background: T.panel, color: T.muted, border: `1px solid ${T.border}` }),
            }}
          >
            ⇄ Convert
          </button>
          <button type="button" onClick={newCard} style={{ cursor: "pointer", flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, background: T.accent, color: T.onAccent, fontWeight: 700, fontSize: 13.5, padding: "11px 16px", border: "none", borderRadius: 10, boxShadow: "0 4px 16px rgba(95,184,176,.22)" }}>
            + New card
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {typeFilterOptions(cards).map((f) => (
            <button key={f.value} type="button" aria-pressed={poolFilter === f.value} onClick={() => setPoolFilter(f.value)} style={{ whiteSpace: "nowrap", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999, ...filterPill(poolFilter === f.value, f.color) }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 244px), 1fr))", gap: 14 }}>
          {shown.map((c) => {
            const tm = typeMeta(c.type), sm = statusMeta(c.status);
            const isOpen = compare.open.some((o) => o.id === c.id);
            const tags = c.tags || [];
            const onKey = (e: KeyboardEvent) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(c.id);
              }
            };
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={(c.title || "Card") + " — open"}
                onClick={() => open(c.id)}
                onKeyDown={onKey}
                style={{ cursor: "pointer", background: T.card, ...frame(isOpen ? T.accent : "#232a2b", "left", tm.color), borderRadius: 12, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 9, transition: "border-color .15s", ...pulse(c.type === "important") }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, color: T.text }}>{c.title}</div>
                  <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <button
                      type="button"
                      title="Edit card"
                      aria-label={"Edit " + (c.title || "card")}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c.id);
                      }}
                      className="hover:!border-[#5fb8b0] hover:!text-[#e9edee]"
                      style={{ cursor: "pointer", width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted2, background: "#0e1214", border: "1px solid #23292b", fontSize: 12 }}
                    >
                      ✎
                    </button>
                    <div style={statusDot(sm.dot, sm.glow)} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={typeTag(tm.color)}>{tm.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sm.text }}>{sm.label}</span>
                  {c.price != null && <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.price }}>{money(c.price, trip?.currency)}</span>}
                </div>
                {c.region && <div style={{ fontSize: 12, color: T.muted2 }}>{c.region}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {c.duration && <span style={{ fontSize: 11, color: T.dim }}>{"◷ " + c.duration}</span>}
                  {tags.length > 0 && <span style={{ fontSize: 11, color: T.dim2 }}>{tags.slice(0, 3).join(" · ")}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: c.day != null ? T.accent : T.dim2 }}>{c.day != null ? "Day " + c.day : "Pool"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {c.priority === "must" && <span style={{ fontSize: 10, fontWeight: 700, color: T.must }}>★ must</span>}
                    {isOpen && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: T.onAccent, background: T.accent, padding: "2px 6px", borderRadius: 5 }}>Open</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {shown.length === 0 && <div style={{ textAlign: "center", color: T.faint, fontSize: 13, padding: "60px 10px" }}>No cards yet — quick-add above to start collecting ideas.</div>}
      </div>
      {fxOpen && <FxPanel onClose={() => setFxOpen(false)} />}
    </div>
  );
}
