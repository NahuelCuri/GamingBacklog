"use client";

// One trip: header with dates and budget, then the Cards / Itinerary / Map tabs.
import { useLayoutEffect, useRef, useState } from "react";
import { CountUp } from "@/components/ui/CountUp";
import { Tick } from "@/components/ui/Tick";
import { budget, tripRange } from "@/lib/trips/model";
import { CardsTab } from "./CardsTab";
import { ItineraryTab } from "./ItineraryTab";
import { T } from "./styles";
import { TripMap } from "./TripMap";
import { useTripCtx, type BoardTab } from "./TripPlanner";

export function TripBoard() {
  const { trip, cards, isMobile: mob, nav, setTab, goHome } = useTripCtx();
  const navRef = useRef<HTMLElement>(null);
  const tabEls = useRef(new Map<BoardTab, HTMLButtonElement>());
  // Underline under the active tab: a 1px bar moved and stretched with transform only.
  const [bar, setBar] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = tabEls.current.get(nav.boardTab);
      if (el) setBar((b) => ({ x: el.offsetLeft, w: el.offsetWidth, animate: !!b }));
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" && navRef.current ? new ResizeObserver(place) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    return () => ro?.disconnect();
  }, [nav.boardTab, cards, mob]);
  if (!trip) return null;
  const b = budget(trip, cards);
  const located = cards.filter((c) => c.loc && isFinite(c.loc.lat)).length;
  const tabs: { k: BoardTab; label: string; cnt: number }[] = [
    { k: "cards", label: "Cards", cnt: cards.length },
    { k: "itinerary", label: "Itinerary", cnt: cards.filter((c) => c.day != null).length },
    { k: "map", label: "Map", cnt: located },
  ];

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ flex: "0 0 auto", padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: mob ? 12 : 18, background: T.panel, flexWrap: mob ? "nowrap" : "wrap" }}>
        <button type="button" onClick={goHome} aria-label="Back to all trips" style={{ cursor: "pointer", flex: "0 0 auto", width: 34, height: 34, borderRadius: 9, background: "#191d1f", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 17 }}>
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, textWrap: "balance", fontSize: mob ? 17 : 20, fontWeight: 800, letterSpacing: "-.01em", ...(mob ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } : {}) }}>{trip.name}</h1>
            {!mob && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim2, background: "#161a1b", padding: "3px 8px", borderRadius: 6 }}>{tripRange(trip)}</div>}
          </div>
          {!mob && <div style={{ fontSize: 12.5, color: T.dim, marginTop: 2 }}>{trip.subtitle}</div>}
        </div>
        {mob ? (
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: T.price, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}><CountUp value={b.spentDisp} /></div>
            <div style={{ fontSize: 10, color: T.dim2, marginTop: 3 }}>of {b.budgetDisp}</div>
          </div>
        ) : (
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div style={{ fontFamily: T.mono, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: T.text, fontWeight: 600 }}>
                <CountUp value={b.spentDisp} />
              </span>
              <span style={{ color: T.dim3 }}>{` / ${b.budgetDisp}`}</span>
            </div>
            <div style={{ marginTop: 5, height: 6, width: 180, borderRadius: 4, background: "#1a1f20", overflow: "hidden", marginLeft: "auto" }}>
              <div style={{ height: "100%", width: b.pct, background: b.color, transformOrigin: "left", animation: "ggrowx 560ms var(--ease-out) 120ms both" }} />
            </div>
          </div>
        )}
      </header>

      <nav ref={navRef} aria-label="Trip views" role="tablist" style={{ position: "relative", flex: "0 0 auto", display: "flex", padding: "0 24px", borderBottom: `1px solid ${T.line}`, background: T.panel }}>
        {tabs.map((t) => {
          const on = nav.boardTab === t.k;
          return (
            <button
              key={t.k}
              ref={(el) => {
                if (el) tabEls.current.set(t.k, el);
                else tabEls.current.delete(t.k);
              }}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.k)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 2px", marginRight: 24, fontSize: 13.5, fontWeight: on ? 700 : 600, color: on ? T.text : T.dim, borderBottom: "2px solid transparent", transition: "color .15s", fontFamily: "inherit" }}
            >
              {`${t.label} · `}
              <Tick value={t.cnt} />
            </button>
          );
        })}
        {bar && (
          <span
            aria-hidden
            style={{
              position: "absolute", left: 0, bottom: 0, width: 1, height: 2, background: T.accent, transformOrigin: "0 0", pointerEvents: "none",
              transform: `translateX(${bar.x}px) scaleX(${bar.w})`, transition: bar.animate ? "transform 320ms var(--ease-out)" : "none",
            }}
          />
        )}
      </nav>

      <main key={nav.boardTab} id="tp-main" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "gfade 160ms var(--ease-out)" }}>
        {nav.boardTab === "cards" && <CardsTab />}
        {nav.boardTab === "itinerary" && <ItineraryTab />}
        {nav.boardTab === "map" && <TripMap />}
      </main>
    </div>
  );
}
