"use client";

// Map tab: the trip's located cards on a vector street map. Scheduled stops are
// numbered per day and joined by a dashed route; unscheduled ones show as
// rings. Picking a day frames its stops; the side list and the pins light each
// other up. The map (MapLibre) loads lazily, the first time this tab opens.
import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { framePoints, frameKey, mapScene } from "@/lib/trips/map-scene";
import { mapStops, type MapDay } from "@/lib/trips/model";
import { T } from "./styles";
import { useTripCtx } from "./TripPlanner";

const TripMapCanvas = lazy(() => import("./TripMapCanvas"));

/** Streets used to come from Overpass and were cached per bounding box; free that space once. */
function forgetOldStreetCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("trip-map-osm:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

/** If the map chunk can't load (offline), say so; the side list keeps working. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Centered text="Map unavailable — check your connection and reopen the tab." /> : this.props.children;
  }
}

function Centered({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: T.mono, fontSize: 12, color: T.dim2, padding: "0 30px", textAlign: "center" }}>
      {text}
    </div>
  );
}

export function TripMap() {
  const { cards, isMobile, openCard } = useTripCtx();
  const [day, setDay] = useState<MapDay>("all");
  const [hot, setHot] = useState<string | null>(null);
  const [resets, setResets] = useState(0);

  useEffect(forgetOldStreetCache, []);

  const stops = useMemo(() => mapStops(cards), [cards]);
  const scene = useMemo(() => mapScene(cards, day), [cards, day]);
  const frame = useMemo(() => framePoints(scene), [scene]);
  const overview = useMemo(() => stops.loc.map((c) => [c.loc!.lng, c.loc!.lat] as [number, number]), [stops.loc]);
  // Re-frame on a new day, a reset, or stops added or moved.
  const fKey = `${day}|${resets}|${frameKey(frame)}`;

  const days: number[] = [];
  stops.sched.forEach((c) => !days.includes(c.day!) && days.push(c.day!));
  const chips: { v: MapDay; label: string }[] = [{ v: "all", label: "All stops" }, ...days.map((d) => ({ v: d, label: "Day " + d })), ...(stops.un.length ? [{ v: "none" as const, label: "Unscheduled" }] : [])];
  const shown = day === "all" ? stops.sched.length : day === "none" ? 0 : stops.sched.filter((c) => c.day === day).length;

  // Side list: stops grouped by day, then unscheduled ones.
  const rows: ({ header: string } | { pin: (typeof scene.pins)[number] })[] = [];
  let hdr: number | null | undefined;
  scene.pins.forEach((p) => {
    if (!p.n) return;
    if (day === "all" && p.day !== hdr) rows.push({ header: "Day " + (hdr = p.day) });
    rows.push({ pin: p });
  });
  const ghosts = scene.pins.filter((p) => !p.n);
  if (ghosts.length) {
    rows.push({ header: "Unscheduled" });
    ghosts.forEach((p) => rows.push({ pin: p }));
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#0a0c0d" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "11px 24px", borderBottom: `1px solid ${T.line}`, background: T.panel }}>
        {chips.map((c) => {
          const on = day === c.v;
          return (
            <button key={String(c.v)} type="button" aria-pressed={on} onClick={() => setDay(c.v)} style={{ cursor: "pointer", whiteSpace: "nowrap", fontFamily: T.mono, fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 7, background: on ? T.accent : "transparent", color: on ? T.onAccent : T.muted2, border: `1px solid ${on ? "transparent" : T.border2}` }}>
              {c.label}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 11, color: T.dim2 }}>{stops.loc.length ? `${shown} numbered · ${stops.loc.length} of ${cards.length} cards located` : ""}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {stops.loc.length > 0 ? (
            <>
              <MapBoundary>
                <Suspense fallback={<Centered text="loading map…" />}>
                  <TripMapCanvas scene={scene} frame={frame} overview={overview} frameKey={fKey} hot={hot} compact={isMobile} onHot={setHot} onOpen={openCard} />
                </Suspense>
              </MapBoundary>
              <button type="button" onClick={() => setResets((n) => n + 1)} style={{ position: "absolute", top: 12, right: 14, zIndex: 6, cursor: "pointer", fontFamily: T.mono, fontSize: 11, color: T.muted, background: "rgba(14,17,18,.9)", border: "1px solid #232a2b", borderRadius: 8, padding: "6px 11px", whiteSpace: "nowrap" }}>
                reset view
              </button>
            </>
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 30px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: T.dim }}>No stops have coordinates yet</div>
              <div style={{ fontSize: 12.5, color: T.faint, maxWidth: 380, textWrap: "pretty" }}>
                Open a card and paste a Google Maps link — or type <span style={{ fontFamily: T.mono, color: T.dim2 }}>35.6764, 139.6500</span> — into its Location field.
              </div>
            </div>
          )}
        </div>
        {!isMobile && rows.length > 0 && (
          <div style={{ flex: "0 0 262px", borderLeft: `1px solid ${T.line}`, background: T.panel, overflowY: "auto", padding: "6px 16px 26px" }}>
            {rows.map((r, i) =>
              "header" in r ? (
                <div key={"h" + i} style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.dim3, padding: "15px 0 7px" }}>
                  {r.header}
                </div>
              ) : (
                <button
                  key={r.pin.id}
                  type="button"
                  onClick={() => openCard(r.pin.id)}
                  // Hovering a stop lights up its pin (and shows its tooltip), and the other way round.
                  onPointerEnter={() => setHot(r.pin.id)}
                  onPointerLeave={() => setHot(null)}
                  onFocus={() => setHot(r.pin.id)}
                  onBlur={() => setHot(null)}
                  aria-label={"Open " + r.pin.title}
                  style={{ width: "calc(100% + 16px)", margin: "0 -8px", textAlign: "left", background: hot === r.pin.id ? "rgba(95,184,176,.08)" : "none", display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 8px", cursor: "pointer", border: "none", borderBottom: "1px solid #171c1d", borderRadius: 8, transition: "background .15s" }}
                >
                  <div
                    style={
                      r.pin.n
                        ? { flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 11, fontWeight: 700, background: r.pin.color, color: "#0a0c0d" }
                        : { flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.dim2, border: `2px solid ${r.pin.color}` }
                    }
                  >
                    {r.pin.n || "·"}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pin.title}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pin.meta}</div>
                  </div>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
