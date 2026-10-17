"use client";

// Itinerary tab: the pool of unscheduled cards and one lane per day.
//
// Every card has a "⋯" button that moves it to any day (a bottom sheet on
// phones), so nothing needs a drag. Dragging still works as a shortcut: right
// away with a mouse, after a short hold on touch screens (so a swipe still
// scrolls). With the keyboard, ←/→ change day and ↑/↓ reorder.
//
// Days move the same way: each day's "⋯" menu moves it earlier, later or to
// any place, and its header drags. The dates stay put; the plan takes the date
// of its new place, and the days whose number changed flash once.
//
// Desktop: the pool sits on the left and the days scroll sideways like any
// board. Phones: one vertical scroll, the pool first and then the days.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { CaretUpIcon, DotsIcon, PlusIcon, StarIcon, WarningCircleIcon } from "@/components/icons";
import { Tick } from "@/components/ui/Tick";
import { useEnterStagger } from "@/lib/hooks/useEnterStagger";
import { play, reducedMotion } from "@/lib/motion";
import { cardAriaLabel, dayHint, lookalikes, money, quickAddCard, removeDay, reorderDay, setCardDay, statusMeta, tripSpan, typeFilterOptions, typeMeta, type TripCard } from "@/lib/trips/model";
import { LookalikeNote } from "./LookalikeNote";
import { useTripCtx } from "./TripPlanner";
import { Button, Chip, IconButton, Kicker, Sheet, SheetItem, TypeLabel, cx, inputCls, tint } from "./ui";

type Over = { day: number | null; index: number } | "none" | null;

function dropTarget(x: number, y: number): { day: number | null; index: number } | null {
  const z = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-dropzone]");
  if (!z) return null;
  const d = z.getAttribute("data-day");
  if (d === "pool") return { day: null, index: 0 };
  const cards = [...z.querySelectorAll("[data-flip]")];
  let index = cards.length;
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) {
      index = i;
      break;
    }
  }
  return { day: Number(d), index };
}

/**
 * Slides cards from their old position when the list re-orders (FLIP). `skip`
 * says the cards moved with their lane: only their new places are taken.
 */
function useFlip(deps: unknown, skip: () => boolean) {
  const last = useRef(new Map<string, DOMRect>());
  const skipped = useRef(skip);
  skipped.current = skip;
  // Takes the cards' current places as where they were: a move already made (a lane that closed up) isn't slid again.
  const settle = () => document.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => last.current.set(el.getAttribute("data-flip")!, el.getBoundingClientRect()));
  useLayoutEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-flip]")];
    if (skipped.current()) return void settle();
    els.forEach((el) => {
      const id = el.getAttribute("data-flip")!;
      const first = last.current.get(id);
      const now = el.getBoundingClientRect();
      if (first && (first.left !== now.left || first.top !== now.top)) {
        el.style.transition = "none";
        el.style.transform = `translate(${first.left - now.left}px,${first.top - now.top}px)`;
        el.getBoundingClientRect();
        requestAnimationFrame(() => {
          el.style.transition = "transform .18s cubic-bezier(.2,.8,.2,1)";
          el.style.transform = "";
        });
      }
      last.current.set(id, now);
    });
  }, [deps]);
  return settle;
}

/** How far from a scroller's edge a dragged card starts scrolling it, px. */
const EDGE = 72;
/** How long lanes take to slide to their places, ms: from the menu, making room during a drag, going back. */
const LANE_MS = { menu: 480, drag: 340, back: 400 };
/** Even in and out, so a lane sets off and settles gently rather than jumping. */
const SLIDE = "cubic-bezier(.45, 0, .2, 1)";
/** The space between lanes (gap-3), px. */
const GAP = 12;

/** Scrolls the element while a drag is held near its edge. */
function edgeScroll(get: () => HTMLElement | null) {
  let raf: number | null = null;
  let dir = { x: 0, y: 0 };
  const step = () => {
    const el = get();
    if (!el || (!dir.x && !dir.y)) return void (raf = null);
    el.scrollLeft += dir.x * 12;
    el.scrollTop += dir.y * 12;
    raf = requestAnimationFrame(step);
  };
  return {
    toward(x: number, y: number, sideways: boolean) {
      const r = get()?.getBoundingClientRect();
      if (!r) return;
      dir = { x: sideways ? (x < r.left + EDGE ? -1 : x > r.right - EDGE ? 1 : 0) : 0, y: y < r.top + EDGE ? -1 : y > r.bottom - EDGE ? 1 : 0 };
      if ((dir.x || dir.y) && raf == null) raf = requestAnimationFrame(step);
    },
    stop: () => void (dir = { x: 0, y: 0 }),
  };
}

export function ItineraryTab() {
  const { trip, cards, data, isMobile: mob, persist, poolFilter, setPoolFilter, openCard, openEdit, moveDay, moveOrder, moveCard, offerUndo } = useTripCtx();
  const [quick, setQuick] = useState("");
  // The text a first Enter was held back for, as a likely repeat; Enter again adds it.
  const [held, setHeld] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [poolOpen, setPoolOpen] = useState(true);
  // The card whose "⋯" menu is open, and the button it hangs from.
  const [menu, setMenu] = useState<string | null>(null);
  const menuBtn = useRef<HTMLElement | null>(null);
  // What scrolls while a card is dragged near its edge: the whole tab on phones, the days on desktop.
  const scroller = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; sx: number; sy: number; moved: boolean; armed: boolean } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const leaving = useRef(false);
  // Each lane keeps an identity of its own (not its day number), so when a day is removed only
  // that lane goes: the rest keep their elements and cards, and just take their new number.
  const laneIds = useRef<number[]>([]);
  const nextLane = useRef(1);
  const cut = useRef<number | null>(null);
  // The lane being dissolved, until the days change (or saving fails and it comes back).
  const fading = useRef<{ el: HTMLElement; as: Animation[] } | null>(null);
  const unfade = () => {
    const f = fading.current;
    fading.current = null;
    leaving.current = false;
    cut.current = null;
    if (!f) return;
    f.as.forEach((a) => a.cancel());
    Object.assign(f.el.style, { pointerEvents: "", minWidth: "", minHeight: "", overflow: "" });
  };
  // A day being dragged by its header: where it came from and the place it would take.
  const [laneDrag, setLaneDrag] = useState<{ from: number; to: number; x: number; y: number } | null>(null);
  // The day whose "⋯" menu is open, and the button it hangs from.
  const [dayMenu, setDayMenu] = useState<number | null>(null);
  const dayMenuBtn = useRef<HTMLElement | null>(null);
  // Where the lanes were just before a day moved (they slide from there), and their running slides.
  const laneWas = useRef<Map<number, DOMRect> | null>(null);
  const laneMs = useRef(0);
  const laneAnims = useRef(new Map<number, Animation>());
  // The days whose number and date just changed, flashed once they render; `to` is scrolled into view.
  const relabel = useRef<{ lo: number; hi: number; to: number } | null>(null);
  const markLanes = (ms: number) => {
    laneMs.current = ms;
    const m = new Map<number, DOMRect>();
    board.current?.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => m.set(Number(el.dataset.lane), el.getBoundingClientRect()));
    laneWas.current = m;
  };
  const settle = useFlip(cards, () => laneWas.current != null || relabel.current != null);

  // After a day moves: the lanes slide to their new places, then the renumbered ones flash.
  useLayoutEffect(() => {
    const was = laneWas.current;
    laneWas.current = null;
    let slid = false;
    if (was)
      board.current?.querySelectorAll<HTMLElement>("[data-lane]").forEach((el) => {
        const id = Number(el.dataset.lane);
        laneAnims.current.get(id)?.cancel();
        const first = was.get(id), now = el.getBoundingClientRect();
        if (!first || (first.left === now.left && first.top === now.top)) return;
        const a = play(el, [{ transform: `translate(${first.left - now.left}px,${first.top - now.top}px)` }, { transform: "none" }], { duration: laneMs.current, easing: SLIDE });
        if (a) laneAnims.current.set(id, a);
        slid ||= !!a;
      });
    const r = relabel.current;
    relabel.current = null;
    if (!r) return;
    for (let d = r.lo; d <= r.hi; d++) {
      const h = board.current?.querySelector<HTMLElement>(`[data-day="${d}"] [data-lane-head]`);
      if (!h) continue;
      // After the slide, so the new numbers show once the lanes are in place.
      h.style.setProperty("--relabel-delay", slid ? laneMs.current * 0.6 + "ms" : "0ms");
      h.classList.remove("tp-relabel");
      void h.offsetWidth; // restart it when the same day flashes twice in a row
      h.classList.add("tp-relabel");
    }
    board.current?.querySelector(`[data-day="${r.to}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  });

  // A card dropped on a day settles with a small pop once the move lands in `cards`.
  const landed = useRef<{ id: string; at: number } | null>(null);
  useLayoutEffect(() => {
    const l = landed.current;
    landed.current = null;
    if (!l || Date.now() - l.at > 1500) return;
    const el = [...document.querySelectorAll("[data-flip]")].find((x) => x.getAttribute("data-flip") === l.id);
    // `scale` rather than `transform`, so it composes with the FLIP slide.
    play(el, [{ scale: "1.03" }, { scale: "1" }], { duration: 260 });
  }, [cards]);

  // "+ Add day": only lanes added after mount slide in.
  useEnterStagger(
    Array.from({ length: trip?.dayCount || 0 }, (_, i) => String(i + 1)),
    (d) => board.current?.querySelector(`[data-day="${d}"]`),
    { skipInitial: true, keyframes: [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }] },
  );

  useEffect(() => () => cleanup.current(), []);
  useLayoutEffect(unfade, [trip?.dayCount]);

  if (!trip) return null;
  const dayCount = trip.dayCount || 0;

  const onCardDown = (id: string) => (e: RPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    pending.current = { id, sx: e.clientX, sy: e.clientY, moved: false, armed: !mob };
    let hold: ReturnType<typeof setTimeout> | undefined;
    const auto = edgeScroll(() => scroller.current);
    const touchMove = (ev: TouchEvent) => {
      if (pending.current?.armed) ev.preventDefault();
    };
    const teardown = () => {
      clearTimeout(hold);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", touchMove);
      document.body.style.userSelect = "";
      auto.stop();
    };
    const cancel = () => {
      teardown();
      pending.current = null;
      setDrag(null);
      setOver(null);
    };
    const move = (ev: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      const dist = Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy);
      if (!p.armed) {
        if (dist > 10) cancel(); // a real move before the hold: the user is scrolling
        return;
      }
      if (!p.moved) {
        if (dist < (mob ? 3 : 5)) return;
        p.moved = true;
        document.body.style.userSelect = "none";
      }
      auto.toward(ev.clientX, ev.clientY, !mob);
      setDrag({ id: p.id, x: ev.clientX, y: ev.clientY });
      setOver(dropTarget(ev.clientX, ev.clientY) ?? "none");
    };
    const up = (ev: PointerEvent) => {
      teardown();
      const p = pending.current;
      pending.current = null;
      setDrag(null);
      setOver(null);
      if (!p || ev.type === "pointercancel") return;
      if (!p.armed || !p.moved) return openCard(p.id);
      const t = dropTarget(ev.clientX, ev.clientY);
      if (t) {
        landed.current = { id: p.id, at: Date.now() };
        void persist({ cards: setCardDay(data.cards, p.id, t.day) });
      }
    };
    cleanup.current = cancel;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    if (mob) {
      window.addEventListener("touchmove", touchMove, { passive: false });
      hold = setTimeout(() => {
        const p = pending.current;
        if (!p) return;
        p.armed = true;
        document.body.style.userSelect = "none";
        try {
          navigator.vibrate?.(12);
        } catch {
          /* unsupported */
        }
        setDrag({ id: p.id, x: p.sx, y: p.sy });
        setOver("none");
      }, 260);
    }
  };

  const cardKey = (id: string) => (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") moveDay(id, 1);
    else if (k === "ArrowLeft") moveDay(id, -1);
    else if (k === "ArrowDown") moveOrder(id, 1);
    else if (k === "ArrowUp") moveOrder(id, -1);
    else return;
    e.preventDefault();
  };
  // Pointer presses open the card when they let go (see onCardDown); this is
  // Enter, Space and screen readers, whose clicks carry no pointer.
  const cardClick = (id: string) => (e: RMouseEvent) => {
    if (e.detail === 0) openCard(id);
  };
  const openMenu = (id: string) => (e: RMouseEvent<HTMLButtonElement>) => {
    menuBtn.current = e.currentTarget;
    setMenu(id);
  };

  // Removing a day: the lane dissolves, then closes up so its neighbours slide
  // over; the change lands when it's gone, with an Undo. Without animation it lands at once.
  const dropDay = (d: number) => {
    const r = removeDay(data, trip.id, d);
    if (!r || leaving.current) return;
    const n = cards.filter((c) => c.day === d).length;
    const before = { trips: data.trips, cards: data.cards };
    const label = `Day ${d} removed` + (n ? ` · ${n} ${n === 1 ? "card" : "cards"} back in the pool` : "");
    const commit = () => persist({ trips: r.trips, cards: r.cards }).then(() => offerUndo(label, before));
    const el = board.current?.querySelector<HTMLElement>(`[data-day="${d}"]`);
    const gone = { opacity: 0, filter: "blur(6px)", transform: "scale(.94)" };
    const size = mob ? { height: el?.offsetHeight + "px", paddingBlock: "12px", borderWidth: "1px", marginBottom: "0px" } : { flexBasis: el?.offsetWidth + "px", paddingInline: "12px", borderWidth: "1px", marginRight: "0px" };
    const shut = mob ? { height: "0px", paddingBlock: "0px", borderWidth: "0px", marginBottom: "-12px" } : { flexBasis: "0px", paddingInline: "0px", borderWidth: "0px", marginRight: "-12px" };
    leaving.current = true;
    const fade = play(el, [{ opacity: 1, filter: "blur(0px)", transform: "none" }, gone], { duration: 240, easing: "ease-out", fill: "forwards" });
    const close = play(el, [size, shut], { duration: 320, delay: 240, easing: "cubic-bezier(.45, 0, .2, 1)", fill: "forwards" });
    if (!fade || !close) {
      fade?.cancel();
      close?.cancel();
      leaving.current = false;
      cut.current = d;
      void commit();
      return;
    }
    // A flex item won't shrink below its content (min-width / min-height: auto): without this the
    // lane stops closing at the width of its header, and the days after it stall, then jump.
    Object.assign(el!.style, { pointerEvents: "none", minWidth: "0", minHeight: "0", overflow: "hidden" });
    fading.current = { el: el!, as: [fade, close] };
    close.onfinish = () => {
      settle();
      cut.current = d;
      commit().catch(unfade);
    };
  };

  // Moving a day: its plan takes place `to`, the days between shift over. `slide` animates the
  // lanes there (from the menu); a drag already shows them in place, so they only relabel.
  const shiftDay = (from: number, to: number, slide: boolean) => {
    const next = reorderDay(data.cards, trip.id, from, to, dayCount);
    if (!next || leaving.current) return;
    const lo = Math.min(from, to), hi = Math.max(from, to);
    // Booked things on the days that change date are worth a second look.
    const booked = trip.start ? cards.filter((c) => c.day != null && c.day >= lo && c.day <= hi && c.status === "booked") : [];
    const label =
      `Day ${from} is now day ${to}` +
      (trip.start ? ` · ${dayHint(trip, to)}` : "") +
      (booked.length === 1 ? ` · check the booking for ${booked[0].title || "a card"}` : booked.length > 1 ? ` · check ${booked.length} bookings` : "");
    const before = { cards: data.cards };
    if (slide) markLanes(LANE_MS.menu);
    // The lanes keep their identity, so each one (and its cards) moves rather than being redrawn.
    const ids = laneIds.current;
    ids.splice(to - 1, 0, ids.splice(from - 1, 1)[0]);
    relabel.current = { lo, hi, to };
    void persist({ cards: next }).then(() => offerUndo(label, before));
  };

  // Dragging a day by its header: right away with a mouse, after a hold on touch. The other
  // days slide aside as it passes their middle.
  const onLaneDown = (from: number) => (e: RPointerEvent<HTMLElement>) => {
    if ((e.button !== undefined && e.button !== 0) || leaving.current) return;
    const el = board.current;
    const lane = e.currentTarget.closest<HTMLElement>("[data-lane]");
    if (!el || !lane) return;
    const sx = e.clientX, sy = e.clientY;
    let armed = !mob, moved = false, to = from;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const auto = edgeScroll(() => scroller.current);
    // Places along the board, taken once: where the day would start at each place, with the
    // others in order around it. They don't shift as lanes slide, so the target can't flicker.
    const at0 = el.getBoundingClientRect();
    const span = (x: HTMLElement) => {
      const r = x.getBoundingClientRect();
      return mob ? { a: r.top - at0.top, s: r.height } : { a: r.left - at0.left, s: r.width };
    };
    const all = [...el.querySelectorAll<HTMLElement>("[data-lane]")];
    const me = span(lane);
    const others = all.filter((x) => x !== lane).map((x) => span(x).s);
    const base = span(all[0]).a;
    const slots = all.map((_, t) => base + others.slice(0, t).reduce((n, s) => n + s + GAP, 0));
    const grab = (mob ? sy : sx) - at0[mob ? "top" : "left"] - me.a;
    const touchMove = (ev: TouchEvent) => {
      if (armed) ev.preventDefault();
    };
    const teardown = () => {
      clearTimeout(hold);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", touchMove);
      document.body.style.userSelect = "";
      auto.stop();
    };
    const cancel = () => {
      teardown();
      if (to !== from) markLanes(LANE_MS.back);
      setLaneDrag(null);
    };
    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
      if (!armed) {
        if (dist > 10) cancel(); // moved before the hold: the user is scrolling
        return;
      }
      if (!moved) {
        if (dist < (mob ? 3 : 5)) return;
        moved = true;
        document.body.style.userSelect = "none";
      }
      auto.toward(ev.clientX, ev.clientY, !mob);
      const r = el.getBoundingClientRect();
      const start = (mob ? ev.clientY - r.top : ev.clientX - r.left) - grab;
      const t = slots.reduce((best, s, i) => (Math.abs(start - s) < Math.abs(start - slots[best]) ? i : best), 0) + 1;
      if (t !== to) {
        to = t;
        markLanes(LANE_MS.drag);
      }
      setLaneDrag({ from, to, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      if (ev.type === "pointercancel" || !moved) return cancel();
      teardown();
      setLaneDrag(null);
      if (to !== from) shiftDay(from, to, false);
    };
    cleanup.current = cancel;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    if (mob) {
      window.addEventListener("touchmove", touchMove, { passive: false });
      hold = setTimeout(() => {
        armed = true;
        document.body.style.userSelect = "none";
        try {
          navigator.vibrate?.(12);
        } catch {
          /* unsupported */
        }
        setLaneDrag({ from, to, x: sx, y: sy });
      }, 260);
    }
  };
  const openDayMenu = (d: number) => (e: RMouseEvent<HTMLButtonElement>) => {
    dayMenuBtn.current = e.currentTarget;
    setDayMenu(d);
  };
  const pickPlace = (d: number, to: number) => {
    setDayMenu(null);
    shiftDay(d, to, true);
  };

  const setDays = (n: number) => void persist({ trips: data.trips.map((x) => (x.id === trip.id ? { ...x, dayCount: n } : x)) });

  const quickCard = quickAddCard(quick, trip.id);
  const quickLike = quickCard ? lookalikes(cards, quickCard) : [];
  // Only a sure repeat holds the Enter back; a similar title just shows the note.
  const quickRepeat = quickLike.some((l) => l.why === "same title" || l.why === "same link");
  const onQuickKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || !quickCard) return;
    if (quickRepeat && held !== quick) return setHeld(quick);
    void persist({ cards: [...data.cards, quickCard] });
    setQuick("");
    setHeld(null);
  };

  const pool = cards.filter((c) => c.day == null);
  const poolShown = pool.filter((c) => c.id !== drag?.id && (poolFilter === "all" || c.type === poolFilter));
  const poolGhost = !!drag && over !== "none" && over?.day === null;
  const dragCard = drag ? data.cards.find((c) => c.id === drag.id) : undefined;
  const ids = laneIds.current;
  if (ids.length > dayCount) {
    ids.splice(ids.length - dayCount === 1 && cut.current != null ? cut.current - 1 : dayCount, ids.length - dayCount);
    cut.current = null;
  }
  while (ids.length < dayCount) ids.push(nextLane.current++);
  const span = tripSpan(trip);
  const menuCard = menu ? cards.find((c) => c.id === menu) : undefined;

  const ghost = (h: number) => <div aria-hidden style={{ height: h }} className="origin-top rounded-[10px] border-[1.5px] border-dashed border-accent bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] [animation:slotIn_.16s_ease]" />;
  const card = (c: TripCard, inPool: boolean) => (
    <BoardCard key={c.id} card={c} inPool={inPool} mob={mob} currency={trip.currency} dragging={drag?.id === c.id} onDown={onCardDown(c.id)} onKey={cardKey(c.id)} onClick={cardClick(c.id)} onMenu={openMenu(c.id)} />
  );

  // ---- pool
  const poolBody = (
    <>
      <div className="px-4 pt-4 pb-2.5">
        {!mob && (
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <Kicker as="h2">{`Pool · ${pool.length}`}</Kicker>
            <span className="text-xs text-muted">not scheduled yet</span>
          </div>
        )}
        <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={onQuickKey} aria-label="Quick add a card" aria-describedby="tp-quick-help" autoComplete="off" spellCheck={false} placeholder="Add an idea — a title or a link" className={inputCls} />
        <div id="tp-quick-help" className="mt-1.5 text-2xs text-muted">
          Press Enter to add it to the pool.
        </div>
        <LookalikeNote found={quickLike} hint={quickRepeat ? (held === quick ? "Press Enter again to add it anyway." : "Enter checks first; press it again to add anyway.") : undefined} className="mt-2" />
        {typeFilterOptions(pool).length > 2 && (
          <div role="group" aria-label="Show in the pool" className="mt-3 flex flex-wrap gap-1.5">
            {typeFilterOptions(pool).map((f) => (
              <Chip key={f.value} on={poolFilter === f.value} color={f.color} onClick={() => setPoolFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className={cx("flex flex-col gap-2 px-3", mob ? "pb-4" : "min-h-0 flex-1 overflow-y-auto pb-24 g-scroll")}>
        {poolShown.map((c) => card(c, true))}
        {poolGhost && ghost(52)}
        {poolShown.length === 0 && !poolGhost && (
          <div className="rounded-[10px] border border-dashed border-wh px-3 py-6 text-center text-xs text-muted">
            {pool.length ? "No cards of this type in the pool." : "Everything is scheduled. New ideas land here."}
          </div>
        )}
      </div>
    </>
  );

  // ---- days
  const toolbar = (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2", mob ? "px-4 pt-4 pb-3" : "border-b border-wf px-5 py-3")}>
      <Kicker as="h2">{`Days · ${dayCount}`}</Kicker>
      {span != null && span !== dayCount && (
        <span className="text-xs text-muted">
          {span > dayCount ? `Your dates cover ${span} days.` : `Your dates cover ${span} ${span === 1 ? "day" : "days"}.`}
          {span > dayCount && (
            <button type="button" onClick={() => setDays(span)} className="ml-1.5 cursor-pointer font-semibold text-accent underline-offset-2 hover:underline">
              {`Add the other ${span - dayCount}`}
            </button>
          )}
        </span>
      )}
      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setDays(dayCount + 1)}>
        <PlusIcon size={13} />
        Add day
      </Button>
    </div>
  );
  // The days in board order; while one is dragged, it already sits at the place it would take.
  const order = Array.from({ length: dayCount }, (_, i) => i + 1);
  if (laneDrag) order.splice(laneDrag.to - 1, 0, order.splice(laneDrag.from - 1, 1)[0]);
  const lanes = (
    <div ref={board} className={mob ? "flex flex-col gap-3 px-4 pb-28" : "flex w-max items-start gap-3 p-5 pb-28"}>
      {order.map((d) => {
        const dayCards = cards.filter((c) => c.day === d);
        const shown = dayCards.filter((c) => c.id !== drag?.id);
        const isOver = over !== "none" && over?.day === d;
        const at = isOver ? Math.max(0, Math.min(over.index, shown.length)) : -1;
        const lifted = laneDrag?.from === d;
        return (
          <section
            key={ids[d - 1]}
            data-dropzone=""
            data-day={d}
            data-lane={ids[d - 1]}
            aria-labelledby={`tp-day-${ids[d - 1]}`}
            className={cx(
              "flex flex-col rounded-[14px] border p-3 transition-[border-color,background-color] duration-150",
              mob ? "w-full" : "w-[280px] shrink-0 snap-start scroll-ml-5",
              lifted
                ? "border-dashed border-accent bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] [&>*]:opacity-35"
                : isOver
                  ? "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]"
                  : "border-wf bg-surface",
            )}
          >
            <div
              onPointerDown={dayCount > 1 ? onLaneDown(d) : undefined}
              onContextMenu={mob ? (e) => e.preventDefault() : undefined}
              title={dayCount > 1 && !mob ? "Drag to move this day" : undefined}
              style={{ touchAction: mob ? "auto" : "none" }}
              className={cx("mb-2.5 flex items-start justify-between gap-2 select-none [-webkit-touch-callout:none]", dayCount > 1 && "cursor-grab")}
            >
              <div data-lane-head="" className="-mx-1.5 -my-0.5 min-w-0 rounded-md px-1.5 py-0.5">
                <h3 id={`tp-day-${ids[d - 1]}`} className="m-0 text-sm font-bold text-text">{"Day " + d}</h3>
                <div className="mt-0.5 font-mono text-2xs text-muted">{dayHint(trip, d)}</div>
              </div>
              <div className="flex items-center gap-1">
                <span aria-label={`${dayCards.length} ${dayCards.length === 1 ? "card" : "cards"}`} className="rounded-md bg-chip2 px-2 py-0.5 font-mono text-2xs text-muted">
                  <Tick value={dayCards.length} />
                </span>
                {dayCount > 1 && (
                  <IconButton aria-label={`Day ${d} options`} aria-haspopup="dialog" title="Move or remove this day" onPointerDown={(e) => e.stopPropagation()} onClick={openDayMenu(d)} className="-mr-1">
                    <DotsIcon size={16} />
                  </IconButton>
                )}
              </div>
            </div>
            <div className="flex min-h-11 flex-col gap-2">
              {shown.map((c, i) => (
                <WithGhost key={c.id} ghost={i === at ? ghost(46) : null}>
                  {card(c, false)}
                </WithGhost>
              ))}
              {at === shown.length && ghost(46)}
              {shown.length === 0 && !isOver && <div className="rounded-[10px] border border-dashed border-wh px-2 py-4 text-center text-xs text-muted">Nothing planned yet</div>}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col tp:flex-row">
      {mob ? (
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <section data-dropzone="" data-day="pool" aria-label="Pool" className="border-b border-wf bg-surface">
            <button type="button" onClick={() => setPoolOpen((o) => !o)} aria-expanded={poolOpen} className="flex w-full cursor-pointer items-center gap-2 px-4 pt-4 text-left">
              <Kicker as="span">{`Pool · ${pool.length}`}</Kicker>
              <span className="text-xs text-muted">not scheduled yet</span>
              <span aria-hidden className={cx("ml-auto text-muted transition-transform duration-200", !poolOpen && "rotate-180")}>
                <CaretUpIcon size={14} />
              </span>
            </button>
            {poolOpen ? poolBody : <div className="h-4" />}
          </section>
          {toolbar}
          {lanes}
        </div>
      ) : (
        <>
          <aside data-dropzone="" data-day="pool" aria-label="Pool" className="flex w-[320px] shrink-0 flex-col border-r border-wf bg-surface">
            {poolBody}
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-bg">
            {toolbar}
            <div ref={scroller} className="g-scroll min-h-0 flex-1 snap-x snap-proximity overflow-auto">
              {lanes}
            </div>
          </div>
        </>
      )}

      {menuCard && (
        <Sheet label={"Move " + (menuCard.title || "card")} anchor={menuBtn} mobile={mob} onClose={() => setMenu(null)}>
          <div className="truncate px-3 pt-1 pb-2 text-sm font-bold text-text">{menuCard.title || "Untitled"}</div>
          <Kicker className="px-3 pb-1">Move to</Kicker>
          <SheetItem on={menuCard.day == null} onClick={() => (moveCard(menuCard.id, null), setMenu(null))}>
            Pool
          </SheetItem>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <SheetItem key={d} on={menuCard.day === d} hint={dayHint(trip, d)} onClick={() => (moveCard(menuCard.id, d), setMenu(null))}>
              {"Day " + d}
            </SheetItem>
          ))}
          <div className="my-1.5 h-px bg-wf" />
          <div className="grid grid-cols-2 gap-1">
            <SheetItem onClick={() => moveOrder(menuCard.id, -1)}>↑ Earlier</SheetItem>
            <SheetItem onClick={() => moveOrder(menuCard.id, 1)}>↓ Later</SheetItem>
          </div>
          <SheetItem onClick={() => (setMenu(null), openEdit(menuCard.id))}>Edit card…</SheetItem>
        </Sheet>
      )}

      {dayMenu != null && dayMenu <= dayCount && (
        <Sheet label={`Day ${dayMenu} options`} anchor={dayMenuBtn} mobile={mob} onClose={() => setDayMenu(null)}>
          <div className="px-3 pt-1 pb-2">
            <div className="text-sm font-bold text-text">{"Day " + dayMenu}</div>
            <div className="mt-0.5 font-mono text-2xs text-muted">{dayHint(trip, dayMenu)}</div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <SheetItem disabled={dayMenu === 1} onClick={() => pickPlace(dayMenu, dayMenu - 1)}>{(mob ? "↑" : "←") + " Earlier"}</SheetItem>
            <SheetItem disabled={dayMenu === dayCount} onClick={() => pickPlace(dayMenu, dayMenu + 1)}>{"Later " + (mob ? "↓" : "→")}</SheetItem>
          </div>
          <Kicker className="px-3 pt-2 pb-1">Move to</Kicker>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <SheetItem key={d} on={d === dayMenu} hint={dayHint(trip, d)} onClick={() => (d === dayMenu ? setDayMenu(null) : pickPlace(dayMenu, d))}>
              {"Day " + d}
            </SheetItem>
          ))}
          <div className="my-1.5 h-px bg-wf" />
          <SheetItem danger onClick={() => (setDayMenu(null), dropDay(dayMenu))}>
            {"Remove day " + dayMenu}
          </SheetItem>
        </Sheet>
      )}

      {laneDrag && (
        <LaneDragPreview
          x={laneDrag.x}
          y={laneDrag.y}
          title={"Day " + laneDrag.from + (laneDrag.to !== laneDrag.from ? " → day " + laneDrag.to : "")}
          hint={dayHint(trip, laneDrag.to)}
          cards={cards.filter((c) => c.day === laneDrag.from)}
        />
      )}

      {drag && dragCard && (
        <div
          aria-hidden
          style={tint(typeMeta(dragCard.type).color, { left: drag.x - 18, top: drag.y - 16, zIndex: "calc(var(--z-float) + 2)" })}
          className="pointer-events-none fixed max-w-[240px] -rotate-2 rounded-[10px] border border-l-[3px] border-wh border-l-[var(--c)] bg-card px-3 py-2.5 shadow-[var(--shadow-pop)] [animation:gliftin_140ms_var(--ease-out)]"
        >
          <div className="truncate text-13 font-semibold text-text">{dragCard.title}</div>
        </div>
      )}
    </div>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** How many of a dragged day's cards show in its preview; the rest are a count and a thicker stack. */
const PEEK = 3;

/** What follows the pointer while a day is dragged: its header, with its cards stacked under it. */
function LaneDragPreview({ x, y, title, hint, cards }: { x: number; y: number; title: string; hint: string; cards: TripCard[] }) {
  const more = cards.length - PEEK;
  // Sheets peeking out below: one per card past the first, up to two, so a full day looks heavier.
  const layers = Math.min(2, Math.max(0, cards.length - 1));
  return (
    <div aria-hidden style={{ left: x - 24, top: y - 22, zIndex: "calc(var(--z-float) + 2)" }} className="pointer-events-none fixed w-[240px] -rotate-1 [animation:gliftin_160ms_var(--ease-out)]">
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          style={{ transformOrigin: "bottom", transform: `translateY(${(i + 1) * 7}px) scale(${1 - (i + 1) * 0.05})`, opacity: 1 - (i + 1) * 0.3 }}
          className="absolute inset-0 -z-10 rounded-[14px] border border-wl bg-card shadow-[var(--shadow-pop)] [animation:gfade_200ms_ease-out_both]"
        />
      ))}
      <div className="relative rounded-[14px] border border-accent bg-surface p-2.5 shadow-[var(--shadow-pop)]">
        <div className="px-0.5">
          <div className="text-sm font-bold text-text">{title}</div>
          <div className="mt-0.5 font-mono text-2xs text-muted">
            {hint} · {plural(cards.length, "card")}
          </div>
        </div>
        {cards.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            {cards.slice(0, PEEK).map((c, i) => (
              <div
                key={c.id}
                style={tint(typeMeta(c.type).color, { animationDelay: i * 40 + "ms" })}
                className="truncate rounded-md border border-l-[3px] border-wf border-l-[var(--c)] bg-card px-2 py-1 text-xs font-semibold text-text [animation:gpop_220ms_var(--ease-out)_both]"
              >
                {c.title || "Untitled"}
              </div>
            ))}
            {more > 0 && <div className="px-0.5 pt-0.5 text-2xs text-muted">{`+${more} more`}</div>}
          </div>
        ) : (
          <div className="mt-2 rounded-md border border-dashed border-wh px-2 py-1 text-2xs text-muted">Nothing planned yet</div>
        )}
      </div>
    </div>
  );
}

function WithGhost({ ghost, children }: { ghost: ReactNode; children: ReactNode }) {
  return (
    <>
      {ghost}
      {children}
    </>
  );
}

function BoardCard({ card: c, inPool, mob, currency, dragging, onDown, onKey, onClick, onMenu }: {
  card: TripCard;
  inPool: boolean;
  mob: boolean;
  currency?: string;
  dragging: boolean;
  onDown(e: RPointerEvent): void;
  onKey(e: KeyboardEvent): void;
  onClick(e: RMouseEvent): void;
  onMenu(e: RMouseEvent<HTMLButtonElement>): void;
}) {
  const tm = typeMeta(c.type), sm = statusMeta(c.status);
  const important = c.type === "important";
  const price = c.price != null ? money(c.price, currency) : "";
  const tags = c.tags || [];
  return (
    <div
      data-flip={c.id}
      onPointerDown={onDown}
      onContextMenu={mob ? (e) => e.preventDefault() : undefined}
      style={tint(tm.color, { touchAction: mob ? "auto" : "none" })}
      className={cx(
        "group relative cursor-grab select-none rounded-[10px] border border-l-[3px] border-l-[var(--c)] transition-[border-color,background-color,opacity] duration-150 [-webkit-touch-callout:none] hover:border-wl hover:border-l-[var(--c)]",
        important ? "border-[color-mix(in_srgb,var(--must)_40%,transparent)] bg-[color-mix(in_srgb,var(--must)_7%,var(--card))]" : "border-wf bg-card",
        dragging && "opacity-40",
      )}
    >
      <button type="button" aria-label={cardAriaLabel(c)} onKeyDown={onKey} onClick={onClick} className="block w-full cursor-[inherit] rounded-[inherit] py-2.5 pr-11 pl-3 text-left">
        <div className="text-13 leading-[1.3] font-semibold text-text">{c.title || "Untitled"}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
          {c.startTime && !inPool && <span className="font-mono font-semibold text-accent2">{c.startTime}</span>}
          <TypeLabel color={tm.color} icon={important ? <WarningCircleIcon size={11} /> : undefined}>
            {tm.label}
          </TypeLabel>
          {c.status !== "idea" && (
            <span style={tint(sm.dot)} className="tp-ink font-semibold">
              {sm.label}
            </span>
          )}
          {c.duration && <span className="text-muted">{c.duration}</span>}
          {price && <span className="font-mono text-price">{price}</span>}
          {inPool && tags.length > 0 && <span className="text-muted">{tags.slice(0, 2).join(" · ")}</span>}
          {c.priority === "must" && (
            <span className="inline-flex items-center gap-0.5 font-bold text-must">
              <StarIcon size={10} />
              must
            </span>
          )}
        </div>
      </button>
      <IconButton aria-label={"Move " + (c.title || "card")} aria-haspopup="dialog" title="Move to another day" onPointerDown={(e) => e.stopPropagation()} onClick={onMenu} className="absolute top-1 right-1">
        <DotsIcon size={16} />
      </IconButton>
    </div>
  );
}
