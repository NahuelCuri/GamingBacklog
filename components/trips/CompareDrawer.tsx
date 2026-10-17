"use client";

// Compare mode: a bottom drawer where cards picked on the Cards tab open side by
// side. On desktop they can be dragged by the header, resized from the corner,
// and the canvas zoomed (buttons or Shift+scroll). The drawer height is dragged
// from its top edge; dragging it very low minimizes it.
import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { ArrowUpRightIcon, CaretUpIcon, CloseIcon, MinusIcon, PinIcon, PlusIcon, SwapIcon } from "@/components/icons";
import { money, typeMeta, type TripCard } from "@/lib/trips/model";
import { Fact, StatusPrio, sourceShort } from "./cardBits";
import { useTripCtx } from "./TripPlanner";
import { Button, IconButton, Kicker, TypeLabel, cx, tagCls, tint } from "./ui";

export interface OpenCard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CompareState {
  on: boolean;
  open: OpenCard[];
  min: boolean;
  /** Drawer height set by dragging, px. */
  h: number | null;
  zoom: number;
}

const W = 322, H = 310, COLS = 3;
const clampZoom = (z: number) => Math.min(1.4, Math.max(0.4, +z.toFixed(2)));

/** Adds a card to the grid of open cards (three per row), or leaves it if already open. */
export function openInCompare(c: CompareState, id: string): CompareState {
  if (c.open.some((o) => o.id === id)) return c;
  const n = c.open.length;
  return {
    ...c,
    ...(n === 0 ? { min: false } : {}),
    open: [...c.open, { id, x: 20 + (n % COLS) * (W + 18), y: 20 + Math.floor(n / COLS) * (H + 18), w: W, h: H }],
  };
}

export const toggleInCompare = (c: CompareState, id: string): CompareState =>
  c.open.some((o) => o.id === id) ? { ...c, open: c.open.filter((o) => o.id !== id) } : openInCompare(c, id);

/** Tracks a pointer drag on window; `move` gets the offset from the start. */
function dragFrom(e: RPointerEvent, move: (dx: number, dy: number, ev: PointerEvent) => void) {
  const sx = e.clientX, sy = e.clientY;
  const onMove = (ev: PointerEvent) => move(ev.clientX - sx, ev.clientY - sy, ev);
  const up = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", up);
    document.body.style.userSelect = "";
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", up);
  document.body.style.userSelect = "none";
}

export function CompareDrawer() {
  const { compare: c, setCompare, data, isMobile, openEdit } = useTripCtx();
  const drawer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const expanded = !c.min;

  // Shift + wheel over the canvas zooms.
  useEffect(() => {
    const el = canvas.current;
    if (!el || isMobile) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      const f = e.deltaY > 0 ? -0.1 : 0.1;
      setCompare((s) => ({ ...s, zoom: clampZoom(s.zoom + f) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isMobile, setCompare, expanded]);

  const resizeDrawer = (e: RPointerEvent) => {
    e.preventDefault();
    const startH = drawer.current?.getBoundingClientRect().height ?? window.innerHeight * 0.5;
    dragFrom(e, (_dx, dy) => {
      const raw = startH - dy;
      if (raw < 240) setCompare((s) => ({ ...s, min: true }));
      else setCompare((s) => ({ ...s, h: Math.min(window.innerHeight * 0.92, raw), min: false }));
    });
  };

  const moveCard = (id: string) => (e: RPointerEvent) => {
    if (isMobile || (e.button !== undefined && e.button !== 0)) return;
    // Move only from the header, or ctrl/⌘-drag anywhere.
    if (!e.ctrlKey && !e.metaKey && !(e.target as HTMLElement).closest("[data-cmp-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    const o = c.open.find((v) => v.id === id);
    if (!o) return;
    const z = c.zoom;
    setCompare((s) => ({ ...s, open: [...s.open.filter((v) => v.id !== id), o] })); // bring to front
    dragFrom(e, (dx, dy) =>
      setCompare((s) => ({ ...s, open: s.open.map((v) => (v.id === id ? { ...v, x: Math.max(0, o.x + dx / z), y: Math.max(0, o.y + dy / z) } : v)) })),
    );
  };

  const resizeCard = (id: string) => (e: RPointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const o = c.open.find((v) => v.id === id);
    if (!o) return;
    const z = c.zoom;
    dragFrom(e, (dx, dy) =>
      setCompare((s) => ({ ...s, open: s.open.map((v) => (v.id === id ? { ...v, w: Math.max(230, o.w + dx / z), h: Math.max(190, o.h + dy / z) } : v)) })),
    );
  };

  const close = (id: string) => setCompare((s) => ({ ...s, open: s.open.filter((v) => v.id !== id) }));
  const cols = c.open.map((o) => ({ o, card: data.cards.find((x) => x.id === o.id) })).filter((x): x is { o: OpenCard; card: TripCard } => !!x.card);
  const countLabel = c.open.length ? c.open.length + (c.open.length === 1 ? " card" : " cards") : "Pick cards above";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[calc(var(--z-float)+1)] flex flex-col justify-end">
      <div
        ref={drawer}
        role="region"
        aria-label="Compare cards"
        style={{ height: c.min ? "auto" : c.h ? c.h + "px" : "auto", maxHeight: c.min ? "80vh" : c.h ? "92vh" : "70vh", minHeight: c.min ? 0 : 200 }}
        className="pointer-events-auto flex origin-bottom-left flex-col rounded-t-[18px] border-t border-wh bg-surface shadow-[0_-20px_60px_var(--shadow-tint)] [animation:drawerRise_.34s_cubic-bezier(.22,1,.36,1)]"
      >
        <div onPointerDown={resizeDrawer} title="Drag to resize" className="flex shrink-0 cursor-ns-resize touch-none flex-col border-b border-wf">
          <div className="flex justify-center pt-2 pb-0.5">
            <div className="h-1 w-10 rounded-full bg-wk" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-1.5 pb-3 tp:px-5">
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCompare((s) => ({ ...s, min: !s.min }))} aria-expanded={expanded} className="flex cursor-pointer items-center gap-3">
              <span aria-hidden className={cx("text-muted transition-transform duration-150", c.min && "rotate-180")}>
                <CaretUpIcon size={13} />
              </span>
              <Kicker as="span">Compare</Kicker>
              <span className="text-13 font-semibold text-text2">{countLabel}</span>
            </button>
            <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-2">
              {c.open.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setCompare((s) => ({ ...s, open: [], min: false }))}>
                  Clear
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setCompare((s) => ({ ...s, min: !s.min }))}>
                {c.min ? "Expand" : "Minimize"}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setCompare((s) => ({ ...s, on: false, open: [], min: false }))}>
                Done
              </Button>
            </div>
          </div>
        </div>

        {expanded ? (
          <div ref={canvas} className={cx("relative min-h-0 flex-1 bg-bg", isMobile ? "flex flex-col gap-3 overflow-x-hidden overflow-y-auto p-3.5" : "g-scroll overflow-auto")}>
            {!isMobile && c.open.length > 0 && (
              <div className="sticky top-3 z-30 float-right mr-3.5 inline-flex items-center gap-0.5 rounded-[10px] border border-wh bg-surface/90 p-1 backdrop-blur-md">
                <IconButton aria-label="Zoom out" title="Zoom out" onClick={() => setCompare((s) => ({ ...s, zoom: clampZoom(s.zoom - 0.1) }))}>
                  <MinusIcon size={15} />
                </IconButton>
                <button type="button" title="Reset zoom" aria-label="Reset zoom" onClick={() => setCompare((s) => ({ ...s, zoom: 1 }))} className="min-w-11 cursor-pointer px-1.5 text-center font-mono text-2xs text-muted hover:text-text">
                  {Math.round(c.zoom * 100)}%
                </button>
                <IconButton aria-label="Zoom in" title="Zoom in" onClick={() => setCompare((s) => ({ ...s, zoom: clampZoom(s.zoom + 0.1) }))}>
                  <PlusIcon size={15} />
                </IconButton>
              </div>
            )}
            {cols.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center">
                <div className="text-accent">
                  <SwapIcon size={26} />
                </div>
                <div className="text-sm font-bold text-text2">Compare mode is on</div>
                <div className="max-w-[320px] text-13 text-muted">
                  {isMobile ? "Tap cards above to add them here. Press Done to leave." : "Click cards above to add them here. Drag a card by its header to arrange it, pull its corner to resize, Shift + scroll to zoom. Press Done to leave."}
                </div>
              </div>
            )}
            <div className={isMobile ? "contents" : "absolute top-0 left-0 origin-top-left"} style={isMobile ? undefined : { transform: `scale(${c.zoom})` }}>
              {cols.map(({ o, card }) => (
                <CompareCard key={o.id} o={o} card={card} mobile={isMobile} onDown={moveCard(o.id)} onResize={resizeCard(o.id)} onClose={() => close(o.id)} onEdit={() => openEdit(o.id)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pt-3 pb-4">
            {cols.map(({ o, card }) => (
              <div key={o.id} style={tint(typeMeta(card.type).color)} className="flex max-w-[220px] shrink-0 items-center gap-1 rounded-[10px] border border-t-[3px] border-wh border-t-[var(--c)] bg-card py-1 pr-1 pl-3">
                <button type="button" onClick={() => setCompare((s) => ({ ...s, min: false }))} className="min-w-0 cursor-pointer truncate text-13 font-semibold text-text">
                  {card.title || "Untitled"}
                </button>
                <IconButton aria-label={"Remove " + (card.title || "card") + " from compare"} onClick={() => close(o.id)}>
                  <CloseIcon size={12} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareCard({ o, card: d, mobile, onDown, onResize, onClose, onEdit }: { o: OpenCard; card: TripCard; mobile: boolean; onDown(e: RPointerEvent): void; onResize(e: RPointerEvent): void; onClose(): void; onEdit(): void }) {
  const { trip } = useTripCtx();
  const tm = typeMeta(d.type);
  const tags = d.tags || [];
  const hasPrice = d.price != null && (d.price as unknown) !== "";
  return (
    <div
      onPointerDown={onDown}
      style={tint(tm.color, mobile ? { height: o.h || 360 } : { left: o.x, top: o.y, width: o.w, height: o.h })}
      className={cx("flex flex-col overflow-hidden rounded-[14px] border border-t-[3px] border-wh border-t-[var(--c)] bg-card select-none", mobile ? "relative w-full shrink-0" : "absolute shadow-[var(--shadow-pop)]")}
    >
      <div data-cmp-handle="" className={cx("flex shrink-0 touch-none items-center justify-between gap-2 border-b border-wf py-1.5 pr-1.5 pl-3.5", !mobile && "cursor-move")}>
        <TypeLabel color={tm.color}>{tm.label}</TypeLabel>
        <IconButton aria-label={"Remove " + (d.title || "card") + " from compare"} onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
          <CloseIcon size={14} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 pt-3.5">
        <div className="mb-2.5 text-base leading-[1.3] font-bold text-text">{d.title || "Untitled"}</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <StatusPrio card={d} />
        </div>
        {(hasPrice || d.startTime || d.duration) && (
          <div className="mb-3 flex gap-2">
            {hasPrice && <Fact label="Price" value={money(d.price, trip?.currency)} big />}
            {d.startTime && <Fact label="Start" value={d.startTime} />}
            {d.duration && <Fact label="Duration" value={d.duration} />}
          </div>
        )}
        {d.region && (
          <div className="mb-3 flex items-center gap-1.5 text-13 text-text2">
            <span className="text-accent">
              <PinIcon size={13} />
            </span>
            {d.region}
          </div>
        )}
        <Kicker className="mb-1">Notes</Kicker>
        <div className={cx("min-h-0 flex-1 overflow-y-auto text-13 leading-relaxed whitespace-pre-wrap", d.notes ? "text-text2" : "text-muted")}>{d.notes || "No notes yet."}</div>
        {d.addedBy && <div className="mt-2 font-mono text-2xs text-muted">added by {d.addedBy}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 border-t border-wf px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {tags.length > 0 && (
            <div className="flex gap-1.5 overflow-hidden">
              {tags.map((t, i) => (
                <span key={i} className={cx(tagCls, "shrink-0")}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {d.source && (
            <a href={d.source} target="_blank" rel="noopener noreferrer" title={d.source} className="flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-accent hover:underline">
              <ArrowUpRightIcon size={12} />
              <span className="truncate">{sourceShort(d.source)}</span>
            </a>
          )}
        </div>
        <Button size="sm" variant="primary" onClick={onEdit} aria-label={"Edit " + (d.title || "card")}>
          Edit
        </Button>
      </div>
      {!mobile && (
        <div onPointerDown={onResize} title="Drag to resize" aria-hidden="true" className="absolute right-0 bottom-0 z-[6] size-5 cursor-nwse-resize touch-none">
          <div className="absolute right-1 bottom-1 size-2 rounded-br-sm border-r-2 border-b-2 border-wl" />
        </div>
      )}
    </div>
  );
}
