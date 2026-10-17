"use client";

// Map tab: the trip's located cards on a vector street map. Scheduled stops are
// numbered per day and joined by a dashed route; unscheduled ones show as
// rings. Picking a day frames its stops; the side list and the pins light each
// other up. The map (MapLibre) loads lazily, the first time this tab opens.
//
// One toolbar holds every control: days, pin types, districts and map layers.
import { Component, lazy, useCallback, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { PinIcon, ResetIcon } from "@/components/icons";
import { loadDistricts, stopsIn, zoneAt, type District, type Districts } from "@/lib/trips/districts";
import { boxOf, framePoints, frameKey, mapScene } from "@/lib/trips/map-scene";
import { blankCard, cleanCard, mapStops, normTitle, TYPES, typeMeta, type MapDay, type TripCard } from "@/lib/trips/model";
import { play } from "@/lib/motion";
import { CardViewBody } from "./dialogs";
import { MapLoading } from "./MapLoading";
import { useTripCtx } from "./TripPlanner";
import { Button, Chip, IconButton, Kicker, Sheet, TypeLabel, cx, inputCls, tint } from "./ui";

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
    return this.state.failed ? <Notice title="Map unavailable" text="Check your connection and reopen the tab." /> : this.props.children;
  }
}

/**
 * A row that opens to its height and closes to nothing, so the box around it
 * grows and shrinks. Its column keeps the content's width even when shut (a
 * clipped row would otherwise count as zero wide), so the box never jumps sideways.
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={!open} style={{ display: "grid", gridTemplateColumns: "max-content", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: "grid-template-rows 260ms var(--ease-out), opacity 200ms ease-out" }}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * What the transit lines and station marks mean, over the map's bottom-left
 * corner. Always mounted, so it can animate: each row folds open or shut as
 * its layer flips, and the box fades out with its last one.
 */
function TransitKey({ lines, stations }: { lines: boolean; stations: boolean }) {
  const on = lines || stations;
  const line = (dash?: string) => (
    <svg width="22" height="6" aria-hidden="true">
      <line x1="1" y1="3" x2="21" y2="3" stroke="#6d86a8" strokeWidth="1.8" strokeDasharray={dash} opacity={dash ? 0.75 : 0.9} />
    </svg>
  );
  const row = "flex items-center gap-2 py-0.5 whitespace-nowrap";
  return (
    <div
      aria-hidden={!on}
      className="pointer-events-none absolute bottom-3 left-3 z-[6] origin-bottom-left rounded-lg border border-white/10 bg-[#0e1112]/90 px-2.5 py-1 font-mono text-2xs text-[#9aa7a4]"
      style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(4px) scale(.97)", transition: "opacity 180ms ease-out, transform 240ms var(--ease-out)" }}
    >
      <Fold open={lines}>
        <div className={row}>{line()}rail · surface</div>
        <div className={row}>{line("3.5 3.5")}underground</div>
      </Fold>
      <Fold open={stations}>
        <div className={row}>
          <span aria-hidden="true" className="flex w-[22px] justify-center">
            <span className="size-2 rounded-[2px] bg-[#0f1517] shadow-[inset_0_0_0_1.5px_#a9bcd6]" />
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
function CardBubble({ card, n, compact, onEdit, onShow, onClose, tail = "down", tailRef }: { card: TripCard; n: number; compact: boolean; onEdit(): void; onShow?(): void; onClose?(): void; tail?: "down" | "right" | null; tailRef?: Ref<SVGSVGElement> }) {
  const tm = typeMeta(card.type);
  return (
    <div role="dialog" aria-label={card.title || "Untitled"} className="relative drop-shadow-[0_18px_40px_rgba(0,0,0,.55)]" style={{ width: compact ? 290 : 340 }}>
      <div style={tint(tm.color, { maxHeight: "var(--bubble-max)" })} className="flex flex-col overflow-hidden rounded-[14px] border border-t-[3px] border-wh border-t-[var(--c)] bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2.5 pt-1.5 pr-1.5 pl-4">
          <TypeLabel color={tm.color}>{tm.label}</TypeLabel>
          {n > 0 && <span className="font-mono text-2xs text-muted">stop #{n}</span>}
          {onClose ? (
            <IconButton aria-label="Close" onClick={onClose} className="ml-auto">
              ×
            </IconButton>
          ) : (
            <span className="h-8" />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-3.5">
          <CardViewBody card={card} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-wf px-3 py-2.5">
          {onShow && (
            <Button size="sm" variant="ghost" onClick={onShow}>
              <PinIcon size={13} />
              Show on map
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
      {/* The tail, down to the pin or across to the row (its height set by the list). */}
      {tail === null ? null : tail === "down" ? (
        <svg width="22" height="10" aria-hidden="true" className="absolute -bottom-[9px] left-1/2 block -translate-x-1/2">
          <path d="M0 0 L11 10 L22 0" fill="var(--surface)" stroke="var(--wh)" strokeWidth="1" />
          <rect x="0" y="-1" width="22" height="1.5" fill="var(--surface)" />
        </svg>
      ) : (
        <svg ref={tailRef} width="10" height="22" aria-hidden="true" className="absolute top-0 -right-[9px] block">
          <path d="M0 0 L10 11 L0 22" fill="var(--surface)" stroke="var(--wh)" strokeWidth="1" />
          <rect x="-1" y="0" width="1.5" height="22" fill="var(--surface)" />
        </svg>
      )}
    </div>
  );
}

/** The district's card, if the user made one: the first whose title is the district's name, else one that has it as whole words ("Shibuya Crossing"). */
function districtCard(cards: TripCard[], name: string) {
  const n = normTitle(name);
  if (!n) return undefined;
  return cards.find((c) => normTitle(c.title || "") === n) ?? cards.find((c) => (" " + normTitle(c.title || "") + " ").includes(" " + n + " "));
}

/**
 * A district's card slid in over the left edge of the map, which keeps working
 * around it. Escape or its cross closes it.
 */
function DistrictPanel({ on, onClose, children }: { on: boolean; onClose(): void; children: ReactNode }) {
  const [vis, setVis] = useState(false);
  // Slides in a frame after it mounts, so a card for another district animates too.
  useEffect(() => {
    const r = requestAnimationFrame(() => setVis(on));
    return () => cancelAnimationFrame(r);
  }, [on]);
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [on, onClose]);
  return (
    <div
      aria-hidden={!on}
      style={{
        position: "absolute", left: 12, top: 12, zIndex: 5, pointerEvents: on ? "auto" : "none", ["--bubble-max" as string]: "calc(100vh - 220px)",
        visibility: vis ? "visible" : "hidden", opacity: vis ? 1 : 0, transform: vis ? "none" : "translateX(-18px)",
        transition: vis ? "opacity 180ms ease-out, transform 280ms var(--ease-out), visibility 0s" : "opacity 140ms ease-out, transform 180ms ease-in, visibility 0s linear 180ms",
      }}
    >
      {children}
    </div>
  );
}

/** No card for the district yet: a short form with its name filled in, so one can be started without leaving the map. */
function DistrictDraft({ name, onSave, onClose }: { name: string; onSave(notes: string): void; onClose(): void }) {
  const [notes, setNotes] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const color = typeMeta("place").color;
  return (
    <div role="dialog" aria-label={name} style={tint(color)} className="w-[340px] max-w-[calc(100vw-60px)] overflow-hidden rounded-[14px] border border-t-[3px] border-wh border-t-[var(--c)] bg-surface shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between gap-2.5 pt-1.5 pr-1.5 pl-4">
        <TypeLabel color={color}>New card</TypeLabel>
        <IconButton aria-label="Close" onClick={onClose}>
          ×
        </IconButton>
      </div>
      <div className="px-4 pt-1 pb-3.5">
        <div className="text-base font-bold text-text">{name}</div>
        <div className="mt-0.5 mb-2.5 text-xs text-muted">No card for this district yet</div>
        <textarea ref={field} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={"Notes about " + name} placeholder="What to remember about it: where to eat, how to get around, what to skip…" rows={6} className={cx(inputCls, "resize-y leading-normal")} />
      </div>
      <div className="flex justify-end gap-2 border-t border-wf px-3 py-2.5">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={() => onSave(notes.trim())}>
          Create card
        </Button>
      </div>
    </div>
  );
}

function Notice({ title, text }: { title: string; text: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#0a0c0d] px-8 text-center">
      <div className="text-sm font-semibold text-[#c6cfcc]">{title}</div>
      <div className="max-w-[380px] text-xs text-pretty text-[#8a9693]">{text}</div>
    </div>
  );
}

/** A checkbox-style row in the Layers and Districts menus. */
function ToggleRow({ on, onClick, children, aside }: { on: boolean; onClick(): void; children: ReactNode; aside?: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm text-text2 transition-colors hover:bg-wc pointer-coarse:min-h-12">
      <span aria-hidden className={cx("flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] text-[10px] font-bold", on ? "border-accent bg-accent text-on-accent" : "border-wl")}>
        {on ? "✓" : ""}
      </span>
      <span className="flex-1">{children}</span>
      {aside}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-wh" />;

export function TripMap() {
  const { cards, isMobile, openEdit, trip, data, persist } = useTripCtx();
  const [day, setDay] = useState<MapDay>("all");
  const [hot, setHot] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  // Bumped when the open stop is opened again: the bubble calls attention to itself.
  const [nudge, setNudge] = useState(0);
  // A row's own bubble: a click on it opens the card beside the list, over the
  // map's edge, pointing at the row; the map stays put.
  const [side, setSide] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sideEl = useRef<HTMLDivElement>(null);
  const sideTail = useRef<SVGSVGElement>(null);
  const [resets, setResets] = useState(0);
  const [showZones, setShowZones] = useState(false);
  const [transit, setTransit] = useState(false);
  const [stations, setStations] = useState(false);
  const [zones, setZones] = useState<{ key: string; d: Districts | null; status: "loading" | "ready" | "error" }>({ key: "", d: null, status: "ready" });
  const [retries, setRetries] = useState(0);
  // Which toolbar menu is open, and their buttons (the popovers hang from them).
  const [menu, setMenu] = useState<"layers" | "districts" | null>(null);
  const layersBtn = useRef<HTMLButtonElement>(null);
  const distBtn = useRef<HTMLButtonElement>(null);

  useEffect(forgetOldStreetCache, []);

  const stops = useMemo(() => mapStops(cards), [cards]);
  // Pin filters. Types come from the located cards; districts from the zones
  // around the stops, judged by where a stop lies, not by its text.
  // Picks that no longer exist are ignored.
  const [pickTypes, setPickTypes] = useState<string[]>([]);
  const [glow, setGlow] = useState<{ zone: District; tick: number } | null>(null);
  const [pickZones, setPickZones] = useState<number[]>([]);
  // The card of the district opened on the map (kept while it slides away), and whether it shows.
  const [dzCard, setDzCard] = useState<string | null>(null);
  // The district with no card yet, whose short form is open in the same place.
  const [dzNew, setDzNew] = useState<string | null>(null);
  const [dzOn, setDzOn] = useState(false);
  const closeDz = useCallback(() => setDzOn(false), []);
  const typeOpts = useMemo(() => TYPES.filter((t) => stops.loc.some((c) => c.type === t.value)), [stops.loc]);
  const types = useMemo(() => pickTypes.filter((v) => typeOpts.some((t) => t.value === v)), [pickTypes, typeOpts]);
  const byType = useMemo(() => (types.length ? cards.filter((c) => types.includes(c.type)) : cards), [cards, types]);
  const baseScene = useMemo(() => mapScene(byType, day), [byType, day]);
  const baseFrame = useMemo(() => framePoints(baseScene), [baseScene]);
  const overview = useMemo(() => stops.loc.map((c) => [c.loc!.lng, c.loc!.lat] as [number, number]), [stops.loc]);
  // Districts around the stops on show (before the district filter, so picking one doesn't refetch):
  // fetched when the layer or the filter needs them and again only when those stops change;
  // opening the menu after a failure retries.
  const needZones = showZones || menu === "districts" || pickZones.length > 0;
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
  // With districts picked the camera frames their whole outline, not just the stops inside.
  const frame = useMemo(() => {
    const zs = picked.length && zd ? zd.zones.filter((z) => picked.includes(z.id)) : [];
    if (!zs.length) return framePoints(scene);
    const b = boxOf(zs.flatMap((z) => z.rings.flat()));
    return [[b.w, b.s], [b.e, b.n]] as [number, number][];
  }, [scene, picked, zd]);
  const filtered = types.length + picked.length;
  const dzData = dzCard ? cards.find((x) => x.id === dzCard) : undefined;
  // A double-click on a district opens the card the user made for it, or starts one with its name.
  const openDistrict = (id: number) => {
    const zone = zd?.zones.find((z) => z.id === id);
    if (!zone) return;
    const card = districtCard(cards, zone.name);
    setDzNew(card ? null : zone.name);
    if (card) setDzCard(card.id);
    setDzOn(true);
  };
  const createDz = (title: string, notes: string) => {
    if (!trip) return;
    const made = cleanCard({ ...blankCard(trip.id), title, notes, price: "" as never, tagInput: "" });
    void persist({ cards: [...data.cards, made] });
    setDzCard(made.id);
    setDzNew(null);
  };

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
  };
  // Any click closes it (a drag, panning the map, doesn't); so does Escape.
  // The map decides for its own clicks, and the open stop's row leaves it be.
  const active = open ?? sideOpen;
  useEffect(() => {
    if (!active) return;
    let down: { x: number; y: number } | null = null;
    const press = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const click = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const t = e.target instanceof Element ? e.target : null;
      if ((open && t?.closest("[data-testid=trip-map]")) || t?.closest("[data-stop]")?.getAttribute("data-stop") === active || t?.closest("[data-bubble]")) return;
      closeAll();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[aria-modal="true"]') && closeAll();
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
  const toggle = <V,>(set: (f: (l: V[]) => V[]) => void, v: V) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  const layersOn = +showZones + +transit + +stations;

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
    <div className="flex min-h-0 flex-1 flex-col bg-[#0a0c0d]">
      <div className="g-noscroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-wf bg-surface px-4 py-2.5 tp:px-6">
        <div role="group" aria-label="Show stops for" className="flex gap-1.5">
          {chips.map((c) => (
            <Chip key={String(c.v)} on={day === c.v} onClick={() => setDay(c.v)}>
              {c.label}
            </Chip>
          ))}
        </div>
        {stops.loc.length > 0 && (
          <>
            {typeOpts.length > 1 && (
              <>
                <Divider />
                <div role="group" aria-label="Pin types" className="flex gap-1.5">
                  {typeOpts.map((t) => (
                    <Chip key={t.value} on={types.includes(t.value)} color={t.color} onClick={() => toggle(setPickTypes, t.value)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            <Divider />
            <Button ref={distBtn} size="sm" variant={picked.length ? "soft" : "secondary"} aria-haspopup="dialog" aria-expanded={menu === "districts"} onClick={() => (loadState === "error" && setRetries((n) => n + 1), setMenu("districts"))}>
              {picked.length ? `Districts · ${picked.length}` : "Districts"}
            </Button>
            <Button ref={layersBtn} size="sm" variant={layersOn ? "soft" : "secondary"} aria-haspopup="dialog" aria-expanded={menu === "layers"} onClick={() => setMenu("layers")} className={zoneState === "loading" ? "tp-scan" : undefined}>
              {layersOn ? `Layers · ${layersOn}` : "Layers"}
            </Button>
            {filtered > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPickTypes([]);
                  setPickZones([]);
                }}
              >
                Clear filters
              </Button>
            )}
            <span className="ml-auto pl-3 text-xs whitespace-nowrap text-muted">{`${stops.loc.length} of ${cards.length} cards on the map`}</span>
            <IconButton aria-label="Reset view" title="Reset view" onClick={() => setResets((n) => n + 1)}>
              <ResetIcon size={15} />
            </IconButton>
          </>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div ref={area} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {lastSide.current && (
            <div ref={sideEl} data-bubble="" className="absolute top-3 right-3 z-[7]" style={{ pointerEvents: sideOpen ? "auto" : "none" }}>
              <div>
                <CardBubble card={lastSide.current.card} n={lastSide.current.n} compact={false} onEdit={() => openEdit(lastSide.current!.card.id)} onShow={() => openStop(lastSide.current!.card.id)} tail="right" tailRef={sideTail} />
              </div>
            </div>
          )}
          {stops.loc.length > 0 ? (
            <>
              <MapBoundary>
                <Suspense fallback={<MapLoading />}>
                  <TripMapCanvas
                    scene={scene}
                    frame={frame}
                    overview={overview}
                    frameKey={fKey}
                    hot={hot}
                    compact={isMobile}
                    onHot={setHot}
                    districts={zoneState === "on" ? zones.d : null}
                    glow={glow}
                    onDistrict={openDistrict}
                    transit={transit}
                    stations={stations}
                    open={open}
                    onOpen={openStop}
                    nudge={nudge}
                    bubble={openCardData && <CardBubble card={openCardData} n={openPin.n} compact={isMobile} onEdit={() => openEdit(openCardData.id)} />}
                  />
                </Suspense>
              </MapBoundary>
              {(dzNew != null || dzData) && (
                <DistrictPanel key={dzNew ?? dzData!.id} on={dzOn} onClose={closeDz}>
                  {dzNew != null ? <DistrictDraft name={dzNew} onSave={(notes) => createDz(dzNew, notes)} onClose={closeDz} /> : <CardBubble card={dzData!} n={0} compact={false} onEdit={() => openEdit(dzData!.id)} onClose={closeDz} tail={null} />}
                </DistrictPanel>
              )}
              <TransitKey lines={transit} stations={stations} />
            </>
          ) : (
            <Notice
              title="No stops have coordinates yet"
              text={
                <>
                  Open a card and paste a Google Maps link — or coordinates like <span className="font-mono text-[#c6cfcc]">35.6764, 139.6500</span> — into its Location field.
                </>
              }
            />
          )}
        </div>
        {!isMobile && rows.length > 0 && (
          <div ref={list} onScroll={() => sideOpen && placeSide()} className="g-scroll w-[272px] shrink-0 overflow-y-auto border-l border-wf bg-surface px-3 pt-1.5 pb-24">
            {rows.map((r, i) =>
              "header" in r ? (
                <Kicker key={"h" + i} as="h3" className="px-1 pt-4 pb-1.5 font-bold">
                  {r.header}
                </Kicker>
              ) : (
                <button
                  key={r.pin.id}
                  type="button"
                  onClick={() => openSide(r.pin.id)}
                  onDoubleClick={() => openStop(r.pin.id)}
                  // Hovering a stop lights up its pin (and shows its tooltip), and the other way round.
                  onPointerEnter={() => setHot(r.pin.id)}
                  onPointerLeave={() => setHot(null)}
                  onFocus={() => setHot(r.pin.id)}
                  onBlur={() => setHot(null)}
                  aria-label={"Open " + r.pin.title}
                  aria-expanded={sideOpen === r.pin.id}
                  data-stop={r.pin.id}
                  className={cx("flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors", hot === r.pin.id || sideOpen === r.pin.id ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "hover:bg-wc")}
                >
                  <span
                    aria-hidden
                    style={r.pin.n ? { background: r.pin.color } : { borderColor: r.pin.color }}
                    className={cx("flex size-[22px] shrink-0 items-center justify-center rounded-full font-mono text-2xs font-bold", r.pin.n ? "text-[#0a0c0d]" : "border-2 text-muted")}
                  >
                    {r.pin.n || "·"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 font-semibold text-text2">{r.pin.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-2xs text-muted">{r.pin.meta}</span>
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {menu === "layers" && (
        <Sheet label="Map layers" anchor={layersBtn} mobile={isMobile} onClose={() => setMenu(null)} width={250}>
          <Kicker className="px-3 pt-1 pb-1.5">Show on the map</Kicker>
          <ToggleRow
            on={showZones}
            onClick={() => (zoneState === "error" ? setRetries((n) => n + 1) : setShowZones((v) => !v))}
            aside={<span className={cx("text-2xs", zoneState === "error" ? "text-warn" : "text-muted")}>{zoneState === "loading" ? "finding…" : zoneState === "error" ? "retry" : zoneState === "none" ? "none here" : ""}</span>}
          >
            Districts
          </ToggleRow>
          <ToggleRow on={transit} onClick={() => setTransit((v) => !v)}>
            Rail lines
          </ToggleRow>
          <ToggleRow on={stations} onClick={() => setStations((v) => !v)}>
            Stations
          </ToggleRow>
        </Sheet>
      )}
      {menu === "districts" && (
        <Sheet label="Filter by district" anchor={distBtn} mobile={isMobile} onClose={() => setMenu(null)} width={260}>
          <Kicker className="px-3 pt-1 pb-1.5">Only stops in</Kicker>
          {zoneOpts.length === 0 && (
            <div className="px-3 py-2 text-13 text-muted">
              {loadState === "loading" ? "Finding districts…" : loadState === "error" ? (
                <>
                  Districts unavailable.{" "}
                  <button type="button" onClick={() => setRetries((n) => n + 1)} className="cursor-pointer font-semibold text-accent hover:underline">
                    Retry
                  </button>
                </>
              ) : "No districts around these stops."}
            </div>
          )}
          {zoneOpts.map((z) => {
            const on = picked.includes(z.id);
            return (
              <ToggleRow
                key={z.id}
                on={on}
                onClick={() => {
                  toggle(setPickZones, z.id);
                  const zone = !on && zd?.zones.find((d) => d.id === z.id);
                  if (zone) setGlow((g) => ({ zone, tick: (g?.tick ?? 0) + 1 }));
                }}
                aside={<span className="font-mono text-2xs text-muted">{z.n}</span>}
              >
                {z.name}
              </ToggleRow>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
