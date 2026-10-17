"use client";

// Map tab: the trip's located cards on a vector street map. Scheduled stops are
// numbered per day and joined by a dashed route; unscheduled ones show as
// rings. Picking a day frames its stops; the side list and the pins light each
// other up. The map (MapLibre) loads lazily, the first time this tab opens.
import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { loadDistricts, stopsIn, zoneAt, type District, type Districts } from "@/lib/trips/districts";
import { framePoints, frameKey, mapScene } from "@/lib/trips/map-scene";
import { mapStops, TYPES, typeMeta, type MapDay, type TripCard } from "@/lib/trips/model";
import { play } from "@/lib/motion";
import { CardViewBody } from "./dialogs";
import { T, btnPrimary, typeTag } from "./styles";
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

const mapBtn: CSSProperties = { pointerEvents: "auto", cursor: "pointer", fontFamily: T.mono, fontSize: 11, color: T.muted, background: "rgba(14,17,18,.9)", borderWidth: 1, borderStyle: "solid", borderColor: "#232a2b", borderRadius: 8, padding: "6px 11px", whiteSpace: "nowrap" };

/**
 * A row that opens to its height and closes to nothing, so the box around it
 * grows and shrinks. Its column keeps the content's width even when shut (a
 * clipped row would otherwise count as zero wide), so the box never jumps sideways.
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={!open} style={{ display: "grid", gridTemplateColumns: "max-content", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: "grid-template-rows 260ms var(--ease-out), opacity 200ms ease-out" }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/**
 * What the transit lines and station marks mean. Always mounted, so it can
 * animate: it fades in under the buttons with its first row, each row folds
 * open or shut as its toggle flips, and it fades out with its last one.
 */
function TransitKey({ lines, stations }: { lines: boolean; stations: boolean }) {
  const on = lines || stations;
  const row: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "2.5px 0", whiteSpace: "nowrap" };
  const line = (dash?: string) => (
    <svg width="22" height="6" aria-hidden="true">
      <line x1="1" y1="3" x2="21" y2="3" stroke="#6d86a8" strokeWidth="1.8" strokeDasharray={dash} opacity={dash ? 0.75 : 0.9} />
    </svg>
  );
  return (
    <div
      aria-hidden={!on}
      style={{
        fontFamily: T.mono, fontSize: 10.5, color: T.dim2, background: "rgba(14,17,18,.86)", border: "1px solid #232a2b", borderRadius: 8, padding: "4.5px 10px",
        opacity: on ? 1 : 0, transform: on ? "none" : "translateY(-4px) scale(.97)", transformOrigin: "top right",
        transition: "opacity 180ms ease-out, transform 240ms var(--ease-out)",
      }}
    >
      <Fold open={lines}>
        <div style={row}>{line()}rail · surface</div>
        <div style={row}>{line("3.5 3.5")}underground</div>
      </Fold>
      <Fold open={stations}>
        <div style={row}>
          <span aria-hidden="true" style={{ width: 22, display: "flex", justifyContent: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#0f1517", boxShadow: "inset 0 0 0 1.5px #a9bcd6" }} />
          </span>
          station
        </div>
      </Fold>
    </div>
  );
}

/**
 * A stop opened up: the card as the view dialog shows it, on a plate that points
 * at it: down at its pin on the map, or right at its row in the side list.
 * Whoever shows it places it; any click closes it.
 */
function CardBubble({ card, n, compact, onEdit, tail = "down", tailRef }: { card: TripCard; n: number; compact: boolean; onEdit(): void; tail?: "down" | "right"; tailRef?: Ref<SVGSVGElement> }) {
  const tm = typeMeta(card.type);
  return (
    <div role="dialog" aria-label={card.title || "Untitled"} style={{ position: "relative", width: compact ? 290 : 340, filter: "drop-shadow(0 18px 40px rgba(0,0,0,.55))" }}>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "var(--bubble-max)", background: T.dialog, border: `1px solid ${T.border}`, borderTop: `3px solid ${tm.color}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 16px 0" }}>
          <span style={typeTag(tm.color)}>{tm.label}</span>
          {n > 0 && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.dim2 }}>stop #{n}</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px 14px" }}>
          <CardViewBody card={card} />
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", padding: "10px 12px", borderTop: `1px solid ${T.line}` }}>
          <button type="button" onClick={onEdit} style={{ ...btnPrimary, padding: "7px 16px" }}>
            Edit
          </button>
        </div>
      </div>
      {/* The tail, down to the pin or across to the row (its height set by the list). */}
      {tail === "down" ? (
        <svg width="22" height="10" aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: -9, transform: "translateX(-50%)", display: "block" }}>
          <path d="M0 0 L11 10 L22 0" fill={T.dialog} stroke={T.border} strokeWidth="1" />
          <rect x="0" y="-1" width="22" height="1.5" fill={T.dialog} />
        </svg>
      ) : (
        <svg ref={tailRef} width="10" height="22" aria-hidden="true" style={{ position: "absolute", right: -9, top: 0, display: "block" }}>
          <path d="M0 0 L10 11 L0 22" fill={T.dialog} stroke={T.border} strokeWidth="1" />
          <rect x="-1" y="0" width="1.5" height="22" fill={T.dialog} />
        </svg>
      )}
    </div>
  );
}

/** Set once the user has opened a pin by double-click: the side list's hint then stays away. */
const HINT_KEY = "trip-map-dblclick-seen";

function Centered({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: T.mono, fontSize: 12, color: T.dim2, padding: "0 30px", textAlign: "center" }}>
      {text}
    </div>
  );
}

export function TripMap() {
  const { cards, isMobile, openEdit } = useTripCtx();
  const [day, setDay] = useState<MapDay>("all");
  const [hot, setHot] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  // Bumped when the open stop is double-clicked again: the bubble calls attention to itself.
  const [nudge, setNudge] = useState(0);
  // A row's own bubble: a click on it opens the card beside the list, over the
  // map's edge, pointing at the row; the map stays put.
  const [side, setSide] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sideEl = useRef<HTMLDivElement>(null);
  const sideTail = useRef<SVGSVGElement>(null);
  // The double-click hint: unknown until storage is read (so it never flashes), then shown until first use.
  const [hintSeen, setHintSeen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setHintSeen(localStorage.getItem(HINT_KEY) === "1");
    } catch {
      setHintSeen(false);
    }
  }, []);
  // A row's click opens its bubble beside the list, unless a second click makes
  // it a double-click, which flies to the pin and opens its bubble there instead.
  const rowClick = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(rowClick.current), []);
  const [resets, setResets] = useState(0);
  const [showZones, setShowZones] = useState(false);
  const [transit, setTransit] = useState(false);
  const [stations, setStations] = useState(false);
  const [zones, setZones] = useState<{ key: string; d: Districts | null; status: "loading" | "ready" | "error" }>({ key: "", d: null, status: "ready" });
  const [retries, setRetries] = useState(0);

  useEffect(forgetOldStreetCache, []);

  const stops = useMemo(() => mapStops(cards), [cards]);
  // Pin filters. Types come from the located cards; districts from the zones
  // behind the districts toggle, judged by where a stop lies, not by its text.
  // Picks that no longer exist are ignored.
  const [distOpen, setDistOpen] = useState(false);
  const [pickTypes, setPickTypes] = useState<string[]>([]);
  const [glow, setGlow] = useState<{ zone: District; tick: number } | null>(null);
  const [pickZones, setPickZones] = useState<number[]>([]);
  const typeOpts = useMemo(() => TYPES.filter((t) => stops.loc.some((c) => c.type === t.value)), [stops.loc]);
  const types = useMemo(() => pickTypes.filter((v) => typeOpts.some((t) => t.value === v)), [pickTypes, typeOpts]);
  const byType = useMemo(() => (types.length ? cards.filter((c) => types.includes(c.type)) : cards), [cards, types]);
  const baseScene = useMemo(() => mapScene(byType, day), [byType, day]);
  const baseFrame = useMemo(() => framePoints(baseScene), [baseScene]);
  const overview = useMemo(() => stops.loc.map((c) => [c.loc!.lng, c.loc!.lat] as [number, number]), [stops.loc]);
  // Districts around the stops on show (before the district filter, so picking one doesn't refetch):
  // fetched when the toggle or the filter needs them and again only when those stops change;
  // a click after a failure retries.
  // The districts list closes on a click anywhere else, or Escape.
  const distBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!distOpen) return;
    const away = (e: PointerEvent) => !distBox.current?.contains(e.target as Node) && setDistOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDistOpen(false);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key);
    };
  }, [distOpen]);
  const needZones = showZones || distOpen || pickZones.length > 0;
  const zKey = baseFrame.map((p) => p.map((v) => v.toFixed(3)).join(",")).join(";");
  useEffect(() => {
    if (!needZones || !baseFrame.length || (zones.key === zKey && zones.status === "ready")) return;
    const ac = new AbortController();
    setZones({ key: zKey, d: null, status: "loading" });
    loadDistricts(baseFrame, ac.signal)
      .then((d) => setZones({ key: zKey, d, status: "ready" }))
      .catch(() => !ac.signal.aborted && setZones({ key: zKey, d: null, status: "error" }));
    return () => ac.abort();
    // baseFrame is read through zKey; zones only gates the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needZones, zKey, retries]);
  const loadState = !needZones ? null : zones.key !== zKey || zones.status === "loading" ? "loading" : zones.status === "error" ? "error" : zones.d ? "on" : "none";
  const zoneState = showZones ? loadState : null;
  const zoneLabel = { loading: "finding districts", error: "districts unavailable · retry", none: "no districts here", on: "districts" }[zoneState ?? "on"];
  // The last districts found stay for the filter while the next ones load.
  const lastZones = useRef<Districts | null>(null);
  if (zones.d) lastZones.current = zones.d;
  const zd = lastZones.current;
  const zoneOpts = useMemo(() => {
    if (!zd) return [];
    const n = stopsIn(zd.zones, baseScene.pins.map((p) => p.at));
    return zd.zones.filter((z) => n.has(z.id)).map((z) => ({ id: z.id, name: z.name, n: n.get(z.id)! })).sort((a, b) => a.name.localeCompare(b.name));
  }, [zd, baseScene]);
  const picked = useMemo(() => pickZones.filter((id) => zoneOpts.some((z) => z.id === id)), [pickZones, zoneOpts]);
  const visible = useMemo(() => {
    if (!picked.length || !zd) return byType;
    return byType.filter((c) => !c.loc || picked.includes(zoneAt(zd.zones, [c.loc.lng, c.loc.lat])?.id ?? -1));
  }, [byType, picked, zd]);
  const scene = useMemo(() => (visible === byType ? baseScene : mapScene(visible, day)), [visible, byType, baseScene, day]);
  const frame = useMemo(() => framePoints(scene), [scene]);
  const filtered = types.length + picked.length;

  // The pin opened into a bubble, while it's on the map. Another day closes it.
  const openPin = opened ? scene.pins.find((p) => p.id === opened) : undefined;
  const openCardData = openPin && cards.find((c) => c.id === openPin.id);
  const open = openCardData ? openPin.id : null;
  const sidePin = side ? scene.pins.find((p) => p.id === side) : undefined;
  const sideCard = sidePin && cards.find((c) => c.id === sidePin.id);
  const sideOpen = sideCard ? sidePin.id : null;
  // The bubble stays drawn while it slips back into its row, showing what it last showed.
  const lastSide = useRef<{ card: TripCard; n: number } | null>(null);
  if (sideCard) lastSide.current = { card: sideCard, n: sidePin!.n };
  const [, sideGone] = useState(0);
  // Where it grows from and shrinks back to: the tail's tip, and the row's height against its own.
  const sideFrom = useRef({ origin: "100% 50%", squash: 0.2 });
  useEffect(() => {
    setOpened(null);
    setSide(null);
  }, [day]);
  const closeAll = () => {
    setOpened(null);
    setSide(null);
  };
  const openSide = (id: string) => {
    // Its row clicked again: a light bounce towards the map.
    if (id === sideOpen)
      return void play(sideEl.current?.firstElementChild, [{ transform: "none" }, { transform: "translateX(-6px)", offset: 0.3 }, { transform: "none", offset: 0.6 }, { transform: "translateX(-2px)", offset: 0.8 }, { transform: "none" }], { duration: 460, easing: "ease-out", fill: "none" });
    setOpened(null);
    setSide(id);
  };
  const openStop = (id: string | null) => {
    setSide(null);
    if (id && id === open) setNudge((n) => n + 1);
    else setOpened(id);
    if (!id || hintSeen) return;
    setHintSeen(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* storage blocked: hidden for this visit only */
    }
  };
  // Any click closes it (a drag, panning the map, doesn't); so does Escape.
  // The map decides for its own clicks, and the open stop's row leaves it be:
  // either may be the start of a double-click on it.
  const active = open ?? sideOpen;
  useEffect(() => {
    if (!active) return;
    let down: { x: number; y: number } | null = null;
    const press = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const click = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const t = e.target instanceof Element ? e.target : null;
      if ((open && t?.closest("[data-testid=trip-map]")) || t?.closest("[data-stop]")?.getAttribute("data-stop") === active) return;
      closeAll();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
    };
  }, [active, open]);

  // The side bubble sits level with its row (kept inside the map), its tail on
  // the row's middle; it follows the row as the list scrolls, and goes when the row does.
  const placeSide = () => {
    const el = sideEl.current, a = area.current;
    const row = sideOpen ? [...(list.current?.querySelectorAll("[data-stop]") ?? [])].find((r) => r.getAttribute("data-stop") === sideOpen) : null;
    if (!el || !a || !row) return;
    const ar = a.getBoundingClientRect(), rr = row.getBoundingClientRect();
    el.style.setProperty("--bubble-max", Math.max(160, ar.height - 24) + "px");
    const y = rr.top + rr.height / 2 - ar.top, h = el.offsetHeight;
    const top = Math.min(Math.max(12, y - h / 2), Math.max(12, ar.height - h - 12));
    el.style.top = top + "px";
    const tail = Math.min(Math.max(14, y - top - 11), h - 36);
    if (sideTail.current) sideTail.current.style.top = tail + "px";
    sideFrom.current = { origin: `100% ${tail + 11}px`, squash: Math.min(1, rr.height / Math.max(h, 1)) };
    if (y < 0 || y > ar.height) setSide(null);
  };
  // In and out through the row: it opens from the tail, row-high and thin, out
  // to its full size, and folds back the same way when it closes.
  const tucked = () => `scale(.06, ${sideFrom.current.squash})`;
  useLayoutEffect(() => {
    const inner = sideEl.current?.firstElementChild;
    if (!sideOpen) {
      if (!lastSide.current) return;
      const done = () => {
        lastSide.current = null;
        sideGone((n) => n + 1);
      };
      const { origin } = sideFrom.current;
      const a = play(inner, [{ transformOrigin: origin, transform: "none", opacity: 1 }, { transformOrigin: origin, transform: tucked(), opacity: 0.6, offset: 0.85 }, { transformOrigin: origin, transform: tucked(), opacity: 0 }], { duration: 230, easing: "cubic-bezier(.5, 0, .75, 0)", fill: "forwards" });
      if (!a) return done();
      a.onfinish = done;
      return () => a.cancel();
    }
    placeSide();
    const { origin } = sideFrom.current;
    play(inner, [{ transformOrigin: origin, transform: tucked(), opacity: 0 }, { transformOrigin: origin, opacity: 1, offset: 0.25 }, { transformOrigin: origin, transform: "none", opacity: 1 }], { duration: 360 });
    addEventListener("resize", placeSide);
    return () => removeEventListener("resize", placeSide);
    // placeSide reads the latest refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideOpen]);

  // Re-frame on a new day, a reset, or stops added or moved.
  const fKey = `${day}|${resets}|${frameKey(frame)}`;

  const days: number[] = [];
  stops.sched.forEach((c) => !days.includes(c.day!) && days.push(c.day!));
  const chips: { v: MapDay; label: string }[] = [{ v: "all", label: "All stops" }, ...days.map((d) => ({ v: d, label: "Day " + d })), ...(stops.un.length ? [{ v: "none" as const, label: "Unscheduled" }] : [])];
  const shown = scene.pins.filter((p) => p.n).length;
  const toggle = <V,>(set: (f: (l: V[]) => V[]) => void, v: V) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  const chip = (on: boolean): CSSProperties => ({ pointerEvents: "auto", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.mono, fontSize: 10.5, padding: "4px 9px", borderRadius: 7, background: on ? "rgba(95,184,176,.14)" : "transparent", color: on ? "#9fd8d1" : T.muted2, border: `1px solid ${on ? "rgba(95,184,176,.4)" : "#232a2b"}` });

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
        <div ref={area} style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {lastSide.current && (
            <div ref={sideEl} style={{ position: "absolute", right: 12, top: 12, zIndex: 7, pointerEvents: sideOpen ? "auto" : "none" }}>
              <div>
                <CardBubble card={lastSide.current.card} n={lastSide.current.n} compact={false} onEdit={() => openEdit(lastSide.current!.card.id)} tail="right" tailRef={sideTail} />
              </div>
            </div>
          )}
          {stops.loc.length > 0 ? (
            <>
              <MapBoundary>
                <Suspense fallback={<Centered text="loading map…" />}>
                  <TripMapCanvas scene={scene} frame={frame} overview={overview} frameKey={fKey} hot={hot} compact={isMobile} onHot={setHot} districts={zoneState === "on" ? zones.d : null} glow={glow} transit={transit}
                    stations={stations}
                    open={open}
                    onOpen={openStop}
                    nudge={nudge}
                    bubble={openCardData && <CardBubble card={openCardData} n={openPin.n} compact={isMobile} onEdit={() => openEdit(openCardData.id)} />}
                  />
                </Suspense>
              </MapBoundary>
              {/* Map controls, and under them the transit key while it's needed. */}
              <div style={{ position: "absolute", top: 12, right: 14, left: 14, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, pointerEvents: "none" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                  <button
                    type="button"
                    aria-pressed={showZones}
                    aria-busy={zoneState === "loading"}
                    className={zoneState === "loading" ? "tp-scan" : undefined}
                    onClick={() => (zoneState === "error" ? setRetries((n) => n + 1) : setShowZones((v) => !v))}
                    style={{ ...mapBtn, display: "flex", alignItems: "center", gap: 7, ...(showZones && { color: zoneState === "on" ? "#9fd8d1" : T.muted, borderColor: "rgba(95,184,176,.4)" }) }}
                  >
                    {zoneState === "loading" && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, animation: "gpulse 1s ease-in-out infinite" }} />}
                    {zoneLabel}
                  </button>
                  {(
                    [
                      ["transit", transit, setTransit],
                      ["stations", stations, setStations],
                    ] as const
                  ).map(([label, on, flip]) => (
                    <button key={label} type="button" aria-pressed={on} onClick={() => flip((v) => !v)} style={{ ...mapBtn, ...(on && { color: "#a9bcd6", borderColor: "rgba(169,188,214,.4)" }) }}>
                      {label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setResets((n) => n + 1)} style={mapBtn}>
                    reset view
                  </button>
                </div>
                <TransitKey lines={transit} stations={stations} />
              </div>
              {/* Pin filters, top left: one chip per type, side by side, and a districts list that drops down. */}
              {(typeOpts.length > 1 || zoneOpts.length > 0 || distOpen) && (
                <div style={{ position: "absolute", top: 12, left: 14, maxWidth: "46%", zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, pointerEvents: "none" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {typeOpts.length > 1 &&
                      typeOpts.map((t) => {
                        const on = types.includes(t.value);
                        return (
                          <button key={t.value} type="button" aria-pressed={on} onClick={() => toggle(setPickTypes, t.value)} style={{ ...mapBtn, ...chip(on), background: on ? "rgba(14,17,18,.95)" : mapBtn.background, padding: "6px 10px", fontSize: 11 }}>
                            <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: t.color }} />
                            {t.label}
                          </button>
                        );
                      })}
                    <div ref={distBox} style={{ position: "relative", display: "flex" }}>
                      <button type="button" aria-pressed={distOpen} aria-expanded={distOpen} onClick={() => (loadState === "error" ? setRetries((n) => n + 1) : setDistOpen((v) => !v))} style={{ ...mapBtn, ...((distOpen || picked.length > 0) && { color: "#9fd8d1", borderColor: "rgba(95,184,176,.4)" }), borderRadius: 8 }}>
                        {picked.length ? `districts · ${picked.length}` : "districts"}{" "}
                        <span aria-hidden style={{ display: "inline-block", transition: "transform 220ms var(--ease-out)", transform: distOpen ? "rotate(180deg)" : "none" }}>▾</span>
                      </button>
                    {(
                      <div aria-hidden={!distOpen} style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: 1, pointerEvents: distOpen ? "auto" : "none", visibility: distOpen ? "visible" : "hidden", opacity: distOpen ? 1 : 0, transform: distOpen ? "none" : "translateY(-5px) scale(.96)", transformOrigin: "top left", transition: distOpen ? "opacity 180ms ease-out, transform 240ms var(--ease-out)" : "opacity 140ms ease-out, transform 160ms ease-in, visibility 0s linear 160ms", display: "flex", flexDirection: "column", minWidth: 190, maxHeight: 260, overflowY: "auto", padding: 4, fontFamily: T.mono, fontSize: 11, background: "rgba(14,17,18,.94)", border: "1px solid #232a2b", borderRadius: 8, boxShadow: "0 10px 28px rgba(0,0,0,.45)" }}>
                        {zoneOpts.length === 0 && <div style={{ padding: "6px 8px", color: T.dim2 }}>{loadState === "loading" ? "finding districts…" : loadState === "error" ? "districts unavailable" : "no districts here"}</div>}
                        {zoneOpts.map((z) => {
                          const on = picked.includes(z.id);
                          return (
                            <button key={z.id} type="button" aria-pressed={on} onClick={() => {
                              toggle(setPickZones, z.id);
                              const zone = !on && zd?.zones.find((d) => d.id === z.id);
                              if (zone) setGlow((g) => ({ zone, tick: (g?.tick ?? 0) + 1 }));
                            }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "5px 8px", borderRadius: 6, border: "none", background: on ? "rgba(95,184,176,.14)" : "transparent", color: on ? "#9fd8d1" : T.muted2, fontFamily: "inherit", fontSize: "inherit" }}>
                              <span aria-hidden style={{ width: 11, height: 11, borderRadius: 3, boxShadow: `inset 0 0 0 1.5px ${on ? "#5fb8b0" : "#3a4446"}`, background: on ? "#5fb8b0" : "transparent" }} />
                              <span style={{ flex: 1 }}>{z.name}</span>
                              <span style={{ color: T.dim2 }}>{z.n}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    </div>
                    {filtered > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickTypes([]);
                          setPickZones([]);
                        }}
                        style={{ ...mapBtn, background: "transparent", borderColor: "transparent", textDecoration: "underline", padding: "6px 4px" }}
                      >
                        clear
                      </button>
                    )}
                  </div>
                </div>
              )}
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
          <div ref={list} onScroll={() => sideOpen && placeSide()} style={{ flex: "0 0 262px", borderLeft: `1px solid ${T.line}`, background: T.panel, overflowY: "auto", padding: "6px 16px 26px" }}>
            {hintSeen !== null && (
              <Fold open={!hintSeen}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, width: 218, margin: "10px 0 2px", padding: "7px 10px", borderRadius: 8, border: `1px dashed ${T.border2}`, fontFamily: T.mono, fontSize: 10.5, lineHeight: 1.45, color: T.dim2, textWrap: "pretty" }}>
                  <span aria-hidden="true" style={{ color: T.accent }}>✦</span>
                  Click a stop to see its card; double-click it, here or on the map, to fly there.
                </div>
              </Fold>
            )}
            {rows.map((r, i) =>
              "header" in r ? (
                <div key={"h" + i} style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.dim3, padding: "15px 0 7px" }}>
                  {r.header}
                </div>
              ) : (
                <button
                  key={r.pin.id}
                  type="button"
                  onClick={(e) => {
                    clearTimeout(rowClick.current);
                    if (e.detail > 1) return;
                    const id = r.pin.id;
                    const show = () => openSide(id);
                    // Keyboard presses (detail 0) open at once.
                    if (!e.detail) return show();
                    rowClick.current = setTimeout(show, 250);
                  }}
                  onDoubleClick={() => {
                    clearTimeout(rowClick.current);
                    openStop(r.pin.id);
                  }}
                  // Hovering a stop lights up its pin (and shows its tooltip), and the other way round.
                  onPointerEnter={() => setHot(r.pin.id)}
                  onPointerLeave={() => setHot(null)}
                  onFocus={() => setHot(r.pin.id)}
                  onBlur={() => setHot(null)}
                  aria-label={"Open " + r.pin.title}
                  aria-expanded={sideOpen === r.pin.id}
                  data-stop={r.pin.id}
                  title="Click to open · double-click to show on the map"
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
