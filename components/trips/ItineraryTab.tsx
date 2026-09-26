"use client";

// Itinerary tab: the pool of unscheduled cards and one lane per day. Cards are
// dragged between them (on phones after a short hold, so a swipe still
// scrolls), or moved with the keyboard: ←/→ change day, ↑/↓ reorder. On desktop
// the lanes sit on a canvas that pans (drag or scroll) and zooms (Ctrl+scroll
// or the buttons).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { cardAriaLabel, dayHint, money, quickAddCard, setCardDay, statusMeta, typeFilterOptions, typeMeta, type TripCard } from "@/lib/trips/model";
import { IMPORTANT_EDGE, T, filterPill, frame, importantCard, input, statusDot } from "./styles";
import { WarningCircleIcon } from "@/components/icons";
import { useTripCtx } from "./TripPlanner";
import { Tick } from "@/components/ui/Tick";
import { useEnterStagger } from "@/lib/hooks/useEnterStagger";
import { play } from "@/lib/motion";

type Over = { day: number | null; index: number } | "none" | null;

const clampZoom = (z: number) => Math.min(1.6, Math.max(0.4, +z.toFixed(2)));
const dotGrid: CSSProperties = { backgroundImage: "radial-gradient(circle at 1px 1px,#161c1e 1px,transparent 0)", backgroundSize: "26px 26px" };

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

/** Slides cards from their old position when the list re-orders (legacy FLIP). */
function useFlip(deps: unknown) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-flip]")];
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
}

export function ItineraryTab() {
  const { trip, cards, data, isMobile: mob, persist, poolFilter, setPoolFilter, openCard, moveDay, moveOrder } = useTripCtx();
  const [quick, setQuick] = useState("");
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const canvas = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; sx: number; sy: number; moved: boolean; armed: boolean } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  useFlip(cards);

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

  // "+ Add day": only columns added after mount slide in.
  useEnterStagger(
    Array.from({ length: trip?.dayCount || 0 }, (_, i) => String(i + 1)),
    (d) => canvas.current?.querySelector(`[data-day="${d}"]`),
    { skipInitial: true, keyframes: [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }] },
  );

  useEffect(() => () => cleanup.current(), []);

  // Wheel on the canvas: pan, or zoom with Ctrl/⌘ (desktop only).
  useEffect(() => {
    const el = canvas.current;
    if (!el || mob) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setView((v) => ({ ...v, zoom: clampZoom(v.zoom + (e.deltaY < 0 ? 0.1 : -0.1)) }));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mob]);

  if (!trip) return null;

  const onCardDown = (id: string) => (e: RPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    pending.current = { id, sx: e.clientX, sy: e.clientY, moved: false, armed: !mob };
    let hold: ReturnType<typeof setTimeout> | undefined;
    let auto: number | null = null, autoDir = 0;
    const autoStep = () => {
      if (!autoDir || !canvas.current) return (auto = null);
      canvas.current.scrollTop += autoDir * 11;
      auto = requestAnimationFrame(autoStep);
    };
    const setAuto = (dir: number) => {
      autoDir = dir;
      if (dir && auto == null) auto = requestAnimationFrame(autoStep);
    };
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
      setAuto(0);
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
      if (mob) {
        if (dist > 3) p.moved = true;
        const cv = canvas.current;
        if (cv) {
          const r = cv.getBoundingClientRect();
          setAuto(ev.clientY < r.top + 72 ? -1 : ev.clientY > r.bottom - 72 ? 1 : 0);
        }
      } else if (!p.moved) {
        if (dist < 5) return;
        p.moved = true;
      }
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
    } else {
      e.preventDefault();
      document.body.style.userSelect = "none";
    }
  };

  const cardKey = (id: string) => (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "Enter" || k === " ") openCard(id);
    else if (k === "ArrowRight") moveDay(id, 1);
    else if (k === "ArrowLeft") moveDay(id, -1);
    else if (k === "ArrowDown") moveOrder(id, 1);
    else if (k === "ArrowUp") moveOrder(id, -1);
    else return;
    e.preventDefault();
  };

  const canvasDown = (e: RPointerEvent) => {
    if (mob) return;
    const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y;
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onQuickKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const card = quickAddCard(quick, trip.id);
    if (!card) return;
    void persist({ cards: [...data.cards, card] });
    setQuick("");
  };

  const pool = cards.filter((c) => c.day == null);
  const poolShown = pool.filter((c) => c.id !== drag?.id && (poolFilter === "all" || c.type === poolFilter));
  const poolGhost = !!drag && over !== "none" && over?.day === null;
  const dragCard = drag ? data.cards.find((c) => c.id === drag.id) : undefined;
  const dayCount = trip.dayCount || 0;

  const ghost = (h: number) => <div style={{ height: h, border: "1.5px dashed #3a6b66", borderRadius: h > 50 ? 10 : 9, background: "rgba(95,184,176,.09)", animation: "slotIn .16s ease", transformOrigin: "top" }} />;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", ...(mob ? { flexDirection: "column" } : {}) }}>
      {/* pool */}
      <div
        data-dropzone=""
        data-day="pool"
        style={
          mob
            ? { flex: "0 0 auto", width: "100%", borderBottom: `1px solid ${T.line}`, display: "flex", flexDirection: "column", background: T.panel }
            : { flex: "0 0 340px", borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column", background: T.panel }
        }
      >
        <div style={{ flex: "0 0 auto", padding: "16px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
            <div style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8c89" }}>{`Pool · ${pool.length}`}</div>
            <div style={{ fontSize: 11.5, color: T.dim3 }}>unscheduled</div>
          </div>
          <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={onQuickKey} aria-label="Quick add a card" autoComplete="off" spellCheck={false} placeholder="Quick add — paste a link or title, Enter" style={{ ...input, padding: "10px 12px" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            {typeFilterOptions(pool).map((f) => (
              <button key={f.value} type="button" aria-pressed={poolFilter === f.value} onClick={() => setPoolFilter(f.value)} style={{ whiteSpace: "nowrap", cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 999, ...filterPill(poolFilter === f.value, f.color) }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div
          style={
            mob
              ? { flex: "0 0 auto", overflowX: "auto", overflowY: "hidden", padding: "4px 12px 12px", display: "flex", flexDirection: "row", gap: 8, alignItems: "stretch" }
              : { flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 24px", display: "flex", flexDirection: "column", gap: 8 }
          }
        >
          {poolShown.map((c) => (
            <BoardCard key={c.id} card={c} lane={false} mob={mob} currency={trip.currency} onDown={onCardDown(c.id)} onKey={cardKey(c.id)} />
          ))}
          {poolGhost && ghost(52)}
          {poolShown.length === 0 && !poolGhost && (
            <div style={{ textAlign: "center", color: T.faint, fontSize: 12.5, padding: "30px 10px" }}>
              Nothing here — quick-add above,
              <br />
              or drag a card back from a day.
            </div>
          )}
        </div>
      </div>

      {/* days */}
      <div
        ref={canvas}
        onPointerDown={canvasDown}
        style={
          mob
            ? { flex: 1, minWidth: 0, minHeight: 0, position: "relative", overflowY: "auto", overflowX: "hidden", ...dotGrid }
            : { flex: 1, minWidth: 0, position: "relative", overflow: "hidden", cursor: "grab", ...dotGrid }
        }
      >
        {!mob && (
          <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "absolute", top: 12, right: 14, zIndex: 30, display: "flex", alignItems: "center", gap: 2, background: "rgba(14,17,18,.92)", border: "1px solid #232a2b", borderRadius: 10, padding: 4, backdropFilter: "blur(6px)" }}>
            <button type="button" aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom - 0.15) }))} style={zoomBtn}>
              −
            </button>
            <button type="button" aria-label="Reset zoom" onClick={() => setView({ zoom: 1, x: 0, y: 0 })} style={{ cursor: "pointer", background: "none", border: "none", fontFamily: T.mono, fontSize: 11, color: T.muted, padding: "0 6px", minWidth: 44, textAlign: "center" }}>
              {Math.round(view.zoom * 100) + "%"}
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom + 0.15) }))} style={{ ...zoomBtn, fontSize: 17 }}>
              +
            </button>
          </div>
        )}
        <div
          style={
            mob
              ? { padding: 14, display: "flex", flexDirection: "column", gap: 14 }
              : { position: "absolute", top: 0, left: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0", padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }
          }
        >
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
            const dayCards = cards.filter((c) => c.day === d);
            const shown = dayCards.filter((c) => c.id !== drag?.id);
            const isOver = over !== "none" && over?.day === d;
            const at = isOver ? Math.max(0, Math.min(over.index, shown.length)) : -1;
            return (
              <div
                key={d}
                data-dropzone=""
                data-day={d}
                style={{ ...(mob ? { width: "100%" } : { flex: "0 0 268px" }), background: isOver ? "#182422" : "#101414", border: `1px solid ${isOver ? T.accent : T.line}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", transition: "border-color .12s,background .12s" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{"Day " + d}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.dim2, marginTop: 1 }}>{dayHint(trip, d)}</div>
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim2, background: T.panel, padding: "3px 7px", borderRadius: 6 }}>
                    <Tick value={dayCards.length} />
                  </div>
                </div>
                <div style={{ minHeight: 40, display: "flex", flexDirection: "column", gap: 7 }}>
                  {shown.map((c, i) => (
                    <FragmentWithGhost key={c.id} ghost={i === at ? ghost(46) : null}>
                      <BoardCard card={c} lane mob={mob} currency={trip.currency} onDown={onCardDown(c.id)} onKey={cardKey(c.id)} />
                    </FragmentWithGhost>
                  ))}
                  {at === shown.length && ghost(46)}
                  {shown.length === 0 && !isOver && (
                    <div style={{ border: `1.5px dashed ${T.border2}`, borderRadius: 9, color: T.faint, fontSize: 11.5, textAlign: "center", padding: "16px 8px" }}>Drop cards here</div>
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void persist({ trips: data.trips.map((x) => (x.id === trip.id ? { ...x, dayCount: (x.dayCount || 0) + 1 } : x)) })}
            style={{ background: "none", cursor: "pointer", ...(mob ? { width: "100%", minHeight: 64 } : { flex: "0 0 132px", alignSelf: "stretch", minHeight: 120 }), border: `1.5px dashed ${T.border2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim2, fontSize: 13, fontWeight: 600 }}
          >
            + Add day
          </button>
        </div>
      </div>

      {drag && dragCard && (
        <div style={{ position: "fixed", left: drag.x - 18, top: drag.y - 16, pointerEvents: "none", zIndex: 200, animation: "gliftin 140ms var(--ease-out)", background: "#1b2123", ...frame("#3a6b66", "left", typeMeta(dragCard.type).color), borderRadius: 9, padding: "9px 12px", boxShadow: "0 14px 34px rgba(0,0,0,.55)", transform: "rotate(-2deg)", maxWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dragCard.title}</div>
        </div>
      )}
    </div>
  );
}

const zoomBtn: CSSProperties = { cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 7, color: T.text2, fontSize: 18 };

function FragmentWithGhost({ ghost, children }: { ghost: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {ghost}
      {children}
    </>
  );
}

function BoardCard({ card: c, lane, mob, currency, onDown, onKey }: { card: TripCard; lane: boolean; mob: boolean; currency?: string; onDown(e: RPointerEvent): void; onKey(e: KeyboardEvent): void }) {
  const tm = typeMeta(c.type), sm = statusMeta(c.status);
  const tags = c.tags || [];
  const important = c.type === "important";
  const base: CSSProperties = { cursor: "grab", touchAction: mob ? "auto" : "none" };
  const edge = (plain: string) => (important ? IMPORTANT_EDGE : plain);
  const label = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {important && <WarningCircleIcon size={10} />}
      {tm.label}
    </span>
  );
  const price = c.price != null ? money(c.price, currency) : "";
  if (lane)
    return (
      <div data-flip={c.id} role="button" tabIndex={0} aria-label={cardAriaLabel(c)} onPointerDown={onDown} onKeyDown={onKey} style={{ ...base, ...importantCard(important, "#161a1b"), ...frame(edge("#232a2b"), "left", tm.color), borderRadius: 9, padding: "9px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{c.title}</div>
          <div style={{ ...statusDot(sm.dot, sm.glow, 8), marginTop: 4 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
          {c.startTime && <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, color: "#93ddd5" }}>{c.startTime}</span>}
          <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: tm.color }}>{label}</span>
          {c.duration && <span style={{ fontSize: 10.5, color: T.dim }}>{c.duration}</span>}
          {price && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.price }}>{price}</span>}
        </div>
      </div>
    );
  return (
    <div data-flip={c.id} role="button" tabIndex={0} aria-label={cardAriaLabel(c)} onPointerDown={onDown} onKeyDown={onKey} style={{ ...base, ...(mob ? { flex: "0 0 auto", width: 212 } : {}), ...importantCard(important, "#171b1d"), ...frame(edge("#23292b"), "left", tm.color), borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: T.text }}>{c.title}</div>
        <div style={{ ...statusDot(sm.dot, sm.glow), marginTop: 4 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: tm.color }}>{label}</span>
        {price && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.price }}>{price}</span>}
        {tags.length > 0 && <span style={{ fontSize: 11, color: T.dim2 }}>{tags.slice(0, 2).join(" · ")}</span>}
        {c.priority === "must" && <span style={{ fontSize: 10, fontWeight: 700, color: T.must }}>★ must</span>}
      </div>
    </div>
  );
}
