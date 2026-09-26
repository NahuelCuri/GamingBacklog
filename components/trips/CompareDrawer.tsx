"use client";

// Compare mode: a bottom drawer where cards tapped on the Cards tab open side by
// side. On desktop they can be dragged by the header, resized from the corner,
// and the canvas zoomed (buttons or Shift+scroll). The drawer height is dragged
// from its top edge; dragging it very low minimizes it.
import { useEffect, useRef, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { prioMeta, statusMeta, statusDotColor, typeMeta, type TripCard } from "@/lib/trips/model";
import { T, btnGhost, frame, typeTag, tagChip } from "./styles";
import { useTripCtx } from "./TripPlanner";

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

const smallBtn: CSSProperties = { ...btnGhost, padding: "7px 13px" };

export function CompareButton({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Compare cards side by side"
      style={{
        font: "inherit", position: "fixed", left: "max(env(safe-area-inset-left, 0px), 22px)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
        zIndex: 55, display: "flex", alignItems: "center", gap: 9, cursor: "pointer", background: "#141210", color: T.accent,
        border: `1.5px solid color-mix(in srgb, ${T.accent} 45%, transparent)`, borderRadius: 999, padding: "12px 18px", fontSize: 13.5, fontWeight: 700,
        boxShadow: "0 6px 20px rgba(0,0,0,.5)", transformOrigin: "bottom left", animation: "compBtnIn .28s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block" }}>
        <path d="M8 4 4 8l4 4M4 8h13M16 20l4-4-4-4M20 16H7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Compare
    </button>
  );
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
  const countLabel = c.open.length ? c.open.length + (c.open.length === 1 ? " card" : " cards") : "Tap cards to add";
  const grid: CSSProperties = { backgroundImage: "radial-gradient(circle at 1px 1px,#161c1e 1px,transparent 0)", backgroundSize: "26px 26px" };

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end", pointerEvents: "none" }}>
      <div
        ref={drawer}
        role="region"
        aria-label="Compare cards"
        style={{
          pointerEvents: "auto", background: "#0f1213", borderTop: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0",
          height: c.min ? "auto" : c.h ? c.h + "px" : "auto", maxHeight: c.min ? "80vh" : c.h ? "92vh" : "70vh", minHeight: c.min ? 0 : 200,
          display: "flex", flexDirection: "column", boxShadow: "0 -20px 60px rgba(0,0,0,.55)", transformOrigin: "bottom left",
          animation: "drawerRise .34s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div onPointerDown={resizeDrawer} title="Drag to resize" style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", cursor: "ns-resize", touchAction: "none", borderBottom: `1px solid ${T.line2}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "7px 0 2px" }}>
            <div style={{ width: 42, height: 4, borderRadius: 3, background: "#3a4245" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 20px 12px" }}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setCompare((s) => ({ ...s, min: !s.min }))}
              aria-expanded={expanded}
              style={{ font: "inherit", background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
            >
              <span aria-hidden="true" style={{ color: T.dim, fontSize: 13, lineHeight: 1, transform: `rotate(${c.min ? "180deg" : "0deg"})`, transition: "transform .15s" }}>
                ⌃
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8c89" }}>Compare</span>
              <span style={{ fontSize: 13, color: T.text2, fontWeight: 600 }}>{countLabel}</span>
            </button>
            <div onPointerDown={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {c.open.length > 0 && (
                <button type="button" onClick={() => setCompare((s) => ({ ...s, open: [], min: false }))} style={smallBtn}>
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setCompare((s) => ({ ...s, min: !s.min }))} style={smallBtn}>
                {c.min ? "Expand" : "Minimize"}
              </button>
              <button
                type="button"
                onClick={() => setCompare((s) => ({ ...s, on: false, open: [], min: false }))}
                style={{ font: "inherit", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: T.onAccent, background: T.accent, border: "none", padding: "7px 15px", borderRadius: 8 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {expanded ? (
          <div
            ref={canvas}
            style={
              isMobile
                ? { flex: 1, minHeight: 0, position: "relative", overflowY: "auto", overflowX: "hidden", padding: 14, display: "flex", flexDirection: "column", gap: 12, ...grid }
                : { flex: 1, minHeight: 0, position: "relative", overflow: "auto", ...grid }
            }
          >
            {!isMobile && c.open.length > 0 && (
              <div style={{ position: "sticky", top: 12, float: "right", marginRight: 14, zIndex: 30, display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(14,17,18,.92)", border: "1px solid #232a2b", borderRadius: 10, padding: 4, backdropFilter: "blur(6px)" }}>
                <ZoomBtn label="Zoom out" onClick={() => setCompare((s) => ({ ...s, zoom: clampZoom(s.zoom - 0.1) }))}>−</ZoomBtn>
                <button type="button" title="Reset zoom" aria-label="Reset zoom" onClick={() => setCompare((s) => ({ ...s, zoom: 1 }))} style={{ cursor: "pointer", background: "none", border: "none", fontFamily: T.mono, fontSize: 11, color: T.muted, padding: "0 6px", minWidth: 44, textAlign: "center" }}>
                  {Math.round(c.zoom * 100)}%
                </button>
                <ZoomBtn label="Zoom in" onClick={() => setCompare((s) => ({ ...s, zoom: clampZoom(s.zoom + 0.1) }))}>+</ZoomBtn>
              </div>
            )}
            {cols.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: T.dim3, textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 24, color: T.accent }}>⇄</div>
                <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 700 }}>Compare mode is on</div>
                <div style={{ fontSize: 12.5, color: T.dim3, maxWidth: 300 }}>
                  Tap any card above to add it here, then drag by the header to arrange and pull the corner to resize. Shift + scroll to zoom. Press Done to exit.
                </div>
              </div>
            )}
            <div style={isMobile ? { display: "contents" } : { position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `scale(${c.zoom})` }}>
              {cols.map(({ o, card }) => (
                <CompareCard key={o.id} o={o} card={card} mobile={isMobile} onDown={moveCard(o.id)} onResize={resizeCard(o.id)} onClose={() => close(o.id)} onEdit={() => openEdit(o.id)} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: "0 0 auto", display: "flex", gap: 8, overflowX: "auto", padding: "12px 20px 16px" }}>
            {cols.map(({ o, card }) => (
              <div key={o.id} style={{ flex: "0 0 auto", maxWidth: 210, display: "flex", alignItems: "center", gap: 8, background: T.card, ...frame(T.border, "top", typeMeta(card.type).color), borderRadius: 10, padding: "8px 11px" }}>
                <button type="button" onClick={() => setCompare((s) => ({ ...s, min: false }))} style={{ font: "inherit", background: "none", border: "none", cursor: "pointer", minWidth: 0, fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {card.title || "Untitled"}
                </button>
                <button type="button" onClick={() => close(o.id)} aria-label={"Remove " + (card.title || "card") + " from compare"} style={{ cursor: "pointer", background: "none", border: "none", color: T.dim, fontSize: 14, lineHeight: 1, flex: "0 0 auto" }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick(): void; children: string }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} style={{ cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 7, color: T.text2, fontSize: 18 }}>
      {children}
    </button>
  );
}

export function Fact({ label, value, size = 14, bold = false }: { label: string; value: string; size?: number; bold?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: T.bg, border: "1px solid #232a2b", borderRadius: 9, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: T.dim2, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: size, color: T.text, fontWeight: bold ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

export function StatusPrio({ card }: { card: TripCard }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border}`, color: T.text2 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusDotColor(card.status) }} />
        {statusMeta(card.status).label || "—"}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 20, background: "rgba(224,168,107,.1)", border: "1px solid rgba(224,168,107,.28)", color: T.must }}>
        {prioMeta(card.priority)?.label || "—"}
      </div>
    </>
  );
}

export const sourceShort = (s: string) => s.replace(/^https?:\/\//, "").replace(/\/$/, "");

function CompareCard({ o, card: d, mobile, onDown, onResize, onClose, onEdit }: { o: OpenCard; card: TripCard; mobile: boolean; onDown(e: RPointerEvent): void; onResize(e: RPointerEvent): void; onClose(): void; onEdit(): void }) {
  const tm = typeMeta(d.type);
  const tags = d.tags || [];
  const hasPrice = d.price != null && (d.price as unknown) !== "";
  const base: CSSProperties = { display: "flex", flexDirection: "column", background: T.card, ...frame(T.border, "top", tm.color), borderRadius: 14, overflow: "hidden", userSelect: "none" };
  return (
    <div
      onPointerDown={onDown}
      style={mobile ? { ...base, position: "relative", width: "100%", flex: "0 0 auto", height: o.h || 360 } : { ...base, position: "absolute", left: o.x, top: o.y, width: o.w, height: o.h, boxShadow: "0 10px 34px rgba(0,0,0,.45)" }}
    >
      <div data-cmp-handle="" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 14px", borderBottom: `1px solid ${T.line2}`, cursor: "move", touchAction: "none" }}>
        <span style={typeTag(tm.color)}>{tm.label}</span>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label={"Remove " + (d.title || "card") + " from compare"} style={{ cursor: "pointer", background: "none", border: "none", color: T.dim, fontSize: 16, lineHeight: 1 }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: "15px 15px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 11 }}>{d.title || "Untitled"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <StatusPrio card={d} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 11 }}>
          {hasPrice && <Fact label="Price" value={"$" + d.price} bold />}
          {d.startTime && <Fact label="Start" value={d.startTime} />}
          {d.duration && <Fact label="Duration" value={d.duration} />}
        </div>
        {d.region && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.muted, marginBottom: 11 }}>
            <span style={{ color: T.accent }}>◉</span>
            {d.region}
          </div>
        )}
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: T.dim2, marginBottom: 5 }}>Notes</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", fontSize: 13, color: T.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.notes || "No notes yet."}</div>
        {d.addedBy && <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.dim3, marginTop: 8 }}>added by {d.addedBy}</div>}
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: `1px solid ${T.line2}` }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 5, overflow: "hidden" }}>
              {tags.map((t, i) => (
                <div key={i} style={{ ...tagChip, flex: "0 0 auto", fontSize: 11, padding: "3px 8px", whiteSpace: "nowrap" }}>
                  {t}
                </div>
              ))}
            </div>
          )}
          {d.source && (
            <a href={d.source} target="_blank" rel="noopener noreferrer" title={d.source} style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ flex: "0 0 auto" }}>↗</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{sourceShort(d.source)}</span>
            </a>
          )}
        </div>
        <button type="button" onClick={onEdit} aria-label={"Edit " + (d.title || "card")} style={{ font: "inherit", cursor: "pointer", flex: "0 0 auto", fontSize: 12.5, fontWeight: 700, color: T.onAccent, background: T.accent, border: "none", padding: "8px 18px", borderRadius: 8 }}>
          Edit
        </button>
      </div>
      {!mobile && (
        <div onPointerDown={onResize} title="Drag to resize" aria-hidden="true" style={{ position: "absolute", right: 0, bottom: 0, width: 20, height: 20, cursor: "nwse-resize", touchAction: "none", zIndex: 6 }}>
          <div style={{ position: "absolute", right: 4, bottom: 4, width: 8, height: 8, borderRight: "2px solid #46504d", borderBottom: "2px solid #46504d", borderBottomRightRadius: 2 }} />
        </div>
      )}
    </div>
  );
}
