"use client";

// Trips home: every trip as a card with its cover, dates, counts, companions
// and budget bar.
import type { KeyboardEvent } from "react";
import { GearIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { useAuth } from "@/lib/auth";
import { budget, tripCards, tripRange } from "@/lib/trips/model";
import { T } from "./styles";
import { useTripCtx } from "./TripPlanner";

const topChip = { cursor: "pointer", borderRadius: 7, background: "#151816", color: "#8b938d", font: "inherit" } as const;

export function TripsHome() {
  const { data, openTrip, newTrip, editTrip } = useTripCtx();
  const { navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const n = data.trips.length;

  return (
    <div>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(12,14,15,.86)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", gap: 18, padding: "14px 28px", flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(null)} title="All libraries" aria-label="All libraries" style={{ display: "flex", alignItems: "baseline", gap: 10, cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}>
            <span translate="no" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em", color: T.text }}>
              Backlog
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: "#59605b" }}>{"// trips"}</span>
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={openSettings}
            title="Settings & admin"
            aria-label="Settings and admin"
            className="hover:!border-[#5fb8b0] hover:!text-[#e8ebe8]"
            style={{ ...topChip, display: "flex", alignItems: "center", gap: 6, fontFamily: T.mono, fontSize: 11, maxWidth: 190, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", transition: "color .2s,border-color .2s" }}
          >
            <GearIcon size={12.5} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</span>
          </button>
          <button type="button" onClick={signOut} title="Sign out" style={{ ...topChip, whiteSpace: "nowrap", fontSize: 12, padding: "7px 10px", border: "1px solid rgba(255,255,255,.06)" }}>
            Sign out
          </button>
        </div>
      </header>

      <main id="tp-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", margin: 0, textWrap: "balance" }}>Where to next?</h1>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: "#4b5558", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{n + (n === 1 ? " trip" : " trips")}</div>
          </div>
          <button type="button" onClick={newTrip} style={{ font: "inherit", cursor: "pointer", background: T.accent, color: T.onAccent, fontWeight: 700, fontSize: 14, padding: "11px 18px", border: "none", borderRadius: 10, boxShadow: "0 4px 16px rgba(95,184,176,.25)" }}>
            + New trip
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 18 }}>
          {data.trips.map((t) => {
            const cs = tripCards(data.cards, t.id);
            const b = budget(t, cs);
            const open = () => openTrip(t.id);
            const onKey = (e: KeyboardEvent) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            };
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={"Open " + (t.name || "trip")}
                onClick={open}
                onKeyDown={onKey}
                className="hover:!border-[#3a6b66]"
                style={{ cursor: "pointer", background: T.card, border: "1px solid #222829", borderRadius: 16, overflow: "hidden", transition: "border-color .15s" }}
              >
                <div style={{ position: "relative", height: 96, background: t.cover, display: "flex", alignItems: "flex-end", padding: "14px 16px" }}>
                  <button
                    type="button"
                    title="Edit trip"
                    aria-label={"Edit " + (t.name || "trip")}
                    onClick={(e) => {
                      e.stopPropagation();
                      editTrip(t.id);
                    }}
                    style={{ cursor: "pointer", position: "absolute", top: 10, right: 10, width: 28, height: 28, border: "none", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.34)", color: "#fff", fontSize: 13, backdropFilter: "blur(3px)" }}
                  >
                    ✎
                  </button>
                  <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.9)", background: "rgba(0,0,0,.28)", padding: "4px 9px", borderRadius: 6, backdropFilter: "blur(3px)" }}>{tripRange(t)}</div>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em", marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: T.muted2, marginBottom: 14 }}>{t.subtitle}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: T.dim }}>
                      <span>
                        <b style={{ color: T.text2, fontWeight: 600 }}>{cs.length}</b> cards
                      </span>
                      <span>
                        <b style={{ color: T.text2, fontWeight: 600 }}>{cs.filter((c) => c.day != null).length}</b> planned
                      </span>
                    </div>
                    <div style={{ display: "flex" }}>
                      {(t.companions || []).map((c, i) => (
                        <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: c.color, color: T.bg, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -6, border: `2px solid ${T.card}` }}>
                          {c.initial}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: T.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: b.pct, background: b.color }} />
                  </div>
                  <div style={{ marginTop: 5, fontFamily: T.mono, fontSize: 11, color: T.dim2, fontVariantNumeric: "tabular-nums" }}>{`${b.spentDisp} of ${b.budgetDisp}`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
