"use client";

// Map tab: the trip's located cards on a street basemap. Scheduled stops are
// numbered per day and joined by a dashed route; unscheduled ones show as
// rings. Filter by day, hover a pin for details, click it to open the card.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { mapBBox, mapPlan, mapStops, projector, typeMeta, type MapDay, type TripCard } from "@/lib/trips/model";
import { bboxKey, emptyGeo, forgetGeo, loadStreets, readCachedGeo, type StreetGeo } from "@/lib/trips/osm";
import { T } from "./styles";
import { useTripCtx } from "./TripPlanner";

interface Pin {
  c: TripCard;
  n: number;
  color: string;
  x: number;
  y: number;
}

const HOME_VIEW = { k: 1, tx: 0, ty: 0 };

export function TripMap() {
  const { cards, isMobile, openCard } = useTripCtx();
  const [day, setDay] = useState<MapDay>("all");
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [view, setView] = useState(HOME_VIEW);
  const [geo, setGeo] = useState<StreetGeo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retryN, setRetryN] = useState(0);
  const [tip, setTip] = useState<Pin | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  const stops = useMemo(() => mapStops(cards), [cards]);
  const plan = useMemo(() => mapPlan(cards, day), [cards, day]);
  const bbox = useMemo(() => (stops.loc.length ? mapBBox(stops.loc) : null), [stops.loc]);
  const key = bbox ? bboxKey(bbox) : null;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.W === el.clientWidth && s.H === el.clientHeight ? s : { W: el.clientWidth, H: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Streets for the current bounding box: cache first, then Overpass.
  useEffect(() => {
    setView(HOME_VIEW);
    if (!bbox || !key) return setGeo(null);
    const cached = readCachedGeo(key);
    if (cached) {
      setGeo(cached);
      setError(false);
      return;
    }
    let live = true;
    setGeo(null);
    setBusy(true);
    setError(false);
    loadStreets(bbox, key, (g) => live && setGeo(g)).then(
      (g) => live && (setGeo(g), setBusy(false)),
      () => live && (setBusy(false), setError(true)),
    );
    return () => {
      live = false;
    };
  }, [key, retryN]); // eslint-disable-line react-hooks/exhaustive-deps -- bbox changes exactly when key does

  // Wheel zooms about the cursor.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = Math.min(1.25, Math.max(0.8, Math.pow(0.9985, e.deltaY)));
      setTip(null);
      setView((v) => {
        const k = Math.min(16, Math.max(0.7, v.k * f)), rf = k / v.k;
        return { k, tx: mx - (mx - v.tx) * rf, ty: my - (my - v.ty) * rf };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const W = size.W || 900, H = size.H || 600;
  const drawn = useMemo(() => {
    if (!bbox) return null;
    const P = projector(bbox, W, H);
    const g = geo || emptyGeo();
    const path = (feats: StreetGeo["a"], close = false) => {
      let d = "";
      for (const f of feats) {
        d += "M" + P.x(f.g[0][0]).toFixed(1) + " " + P.y(f.g[0][1]).toFixed(1);
        for (let j = 1; j < f.g.length; j++) d += "L" + P.x(f.g[j][0]).toFixed(1) + " " + P.y(f.g[j][1]).toFixed(1);
        if (close) d += "Z";
      }
      return d;
    };
    const pins: Pin[] = [
      ...plan.numbered.map((o) => ({ c: o.c, n: o.n, color: typeMeta(o.c.type).color, x: P.x(o.c.loc!.lng), y: P.y(o.c.loc!.lat) })),
      ...plan.ghosts.map((c) => ({ c, n: 0, color: typeMeta(c.type).color, x: P.x(c.loc!.lng), y: P.y(c.loc!.lat) })),
    ];
    let route = "", prevDay: number | null | undefined;
    plan.numbered.forEach((o) => {
      route += (o.c.day === prevDay ? "L" : "M") + P.x(o.c.loc!.lng).toFixed(1) + " " + P.y(o.c.loc!.lat).toFixed(1);
      prevDay = o.c.day;
    });
    return { k: path(g.k, true), p: path(g.p, true), c: path(g.c), b: path(g.b), a: path(g.a), w: path(g.w), route, pins };
  }, [bbox, geo, plan, W, H]);

  const onDown = (e: RPointerEvent) => {
    const el = box.current!;
    const sx = e.clientX, sy = e.clientY, v0 = view;
    dragged.current = false;
    el.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        dragged.current = true;
        setTip(null);
      }
      setView({ ...v0, tx: v0.tx + dx, ty: v0.ty + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.style.cursor = "grab";
      setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const days: number[] = [];
  stops.sched.forEach((c) => !days.includes(c.day!) && days.push(c.day!));
  const chips: { v: MapDay; label: string }[] = [{ v: "all", label: "All stops" }, ...days.map((d) => ({ v: d, label: "Day " + d })), ...(stops.un.length ? [{ v: "none" as const, label: "Unscheduled" }] : [])];
  const shown = day === "all" ? stops.sched.length : day === "none" ? 0 : stops.sched.filter((c) => c.day === day).length;

  // Side list: stops grouped by day, then unscheduled ones.
  const rows: ({ header: string } | { pin: Pin; meta: string })[] = [];
  let hdr: number | null | undefined;
  drawn?.pins.forEach((p) => {
    if (p.n) {
      if (day === "all" && p.c.day !== hdr) rows.push({ header: "Day " + (hdr = p.c.day) });
      rows.push({ pin: p, meta: [typeMeta(p.c.type).label, p.c.startTime, p.c.duration].filter(Boolean).join(" · ") });
    }
  });
  const ghosts = drawn?.pins.filter((p) => !p.n) || [];
  if (ghosts.length) {
    rows.push({ header: "Unscheduled" });
    ghosts.forEach((p) => rows.push({ pin: p, meta: [typeMeta(p.c.type).label, p.c.duration].filter(Boolean).join(" · ") }));
  }

  const overlayMsg: CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" };

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
          <div ref={box} onPointerDown={onDown} data-testid="trip-map" style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}>
            {drawn && (
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label="Map of the trip's stops">
                <rect width={W} height={H} fill="#0a0c0d" />
                <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
                  <path d={drawn.k} fill="#0e1412" stroke="none" />
                  <path d={drawn.p} fill="#0d1719" stroke="none" />
                  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d={drawn.c} stroke="#1a2123" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                    <path d={drawn.b} stroke="#252d2f" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                    <path d={drawn.a} stroke="#313b3d" strokeWidth={1.7} vectorEffect="non-scaling-stroke" />
                    <path d={drawn.w} stroke="#17292c" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
                  </g>
                  {drawn.route && <path d={drawn.route} fill="none" stroke={T.accent} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.5} vectorEffect="non-scaling-stroke" />}
                  {drawn.pins.map((p) => (
                    <g
                      key={p.c.id}
                      className="pin"
                      transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${(1 / view.k).toFixed(4)})`}
                      style={{ cursor: "pointer" }}
                      onPointerEnter={() => setTip(p)}
                      onPointerLeave={() => setTip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragged.current) return;
                        setTip(null);
                        openCard(p.c.id);
                      }}
                    >
                      {p.n ? (
                        <>
                          <circle r={14} fill={p.color || T.accent} stroke="#0a0c0d" strokeWidth={2.5} />
                          <text y={4.6} textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize={12.5} fontWeight={700} fill="#0a0c0d">
                            {p.n}
                          </text>
                        </>
                      ) : (
                        <circle r={7} fill="#0a0c0d" stroke={p.color || "#5f6b68"} strokeWidth={2.4} />
                      )}
                    </g>
                  ))}
                </g>
              </svg>
            )}
          </div>
          {tip && (
            <div style={{ position: "absolute", left: tip.x * view.k + view.tx, top: tip.y * view.k + view.ty, transform: "translate(-50%,-150%)", pointerEvents: "none", zIndex: 7, background: "rgba(15,18,19,.96)", border: `1px solid ${T.border2}`, borderRadius: 9, padding: "7px 10px", boxShadow: "0 10px 28px rgba(0,0,0,.55)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{(tip.n ? tip.n + ". " : "") + (tip.c.title || "Untitled")}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted2, marginTop: 3 }}>
                {[typeMeta(tip.c.type).label, tip.c.day != null ? "Day " + tip.c.day : "Unscheduled", tip.c.startTime || "", tip.c.duration || ""].filter(Boolean).join(" · ")}
              </div>
            </div>
          )}
          {busy && <div style={{ ...overlayMsg, fontFamily: T.mono, fontSize: 12, color: T.dim2 }}>drawing the streets…</div>}
          {!stops.loc.length && (
            <div style={{ ...overlayMsg, flexDirection: "column", gap: 8, padding: "0 30px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: T.dim }}>No stops have coordinates yet</div>
              <div style={{ fontSize: 12.5, color: T.faint, maxWidth: 380, textWrap: "pretty" }}>
                Open a card and paste a Google Maps link — or type <span style={{ fontFamily: T.mono, color: T.dim2 }}>35.6764, 139.6500</span> — into its Location field.
              </div>
            </div>
          )}
          {error && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => {
                  if (key) forgetGeo(key);
                  setRetryN((n) => n + 1);
                }}
                style={{ cursor: "pointer", fontSize: 12, color: T.warn, background: "rgba(15,18,19,.94)", border: "1px solid #3a2f28", borderRadius: 8, padding: "7px 12px" }}
              >
                Street data unavailable — pins shown on plain ground. Retry
              </button>
            </div>
          )}
          {stops.loc.length > 0 && (
            <>
              <button type="button" onClick={() => setView(HOME_VIEW)} style={{ position: "absolute", top: 12, right: 14, zIndex: 6, cursor: "pointer", fontFamily: T.mono, fontSize: 11, color: T.muted, background: "rgba(14,17,18,.9)", border: "1px solid #232a2b", borderRadius: 8, padding: "6px 11px", whiteSpace: "nowrap" }}>
                reset view
              </button>
              <div style={{ position: "absolute", left: 14, bottom: 12, zIndex: 6, fontFamily: T.mono, fontSize: 10.5, color: T.faint, pointerEvents: "none" }}>drag to pan · scroll to zoom · click a pin</div>
            </>
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
                <button key={r.pin.c.id} type="button" onClick={() => openCard(r.pin.c.id)} aria-label={"Open " + (r.pin.c.title || "stop")} style={{ width: "100%", textAlign: "left", background: "none", display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", cursor: "pointer", border: "none", borderBottom: "1px solid #171c1d" }}>
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
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pin.c.title || "Untitled"}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.meta}</div>
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
