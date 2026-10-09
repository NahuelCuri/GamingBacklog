"use client";

import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/** Segmented control container (legacy: topchip bg, 9px radius, 3px inset). The selection is one highlight that
 *  slides between pills: accent in the box, a neutral chip when `bare` (filter rows, holding `quiet` pills).
 *  Until it has been measured (`data-slid` unset) the active pill paints its own fill, so it never goes blank. */
export function PillGroup({
  children,
  label,
  role = "group",
  bare,
  className = "",
  style,
}: {
  children: ReactNode;
  label?: string;
  role?: "group" | "tablist";
  bare?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mark = useSlidingMark(box);
  return (
    <div
      ref={box}
      role={role}
      data-slid={mark ? "" : undefined}
      aria-label={label}
      className={"group/pills relative flex gap-[3px] " + (bare ? "" : "rounded-[9px] border border-wd bg-topchip p-[3px] ") + className}
      style={style}
    >
      {mark && (
        <span
          aria-hidden
          className={"pointer-events-none absolute top-0 left-0 rounded-md " + (bare ? "bg-chip " : "bg-accent ") + (mark.animate ? "motion-safe:transition-[transform,width,height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.3,1.2,.4,1)]" : "")}
          style={{ width: mark.w, height: mark.h, transform: `translate(${mark.x}px, ${mark.y}px)` }}
        />
      )}
      {children}
    </div>
  );
}

type Mark = { x: number; y: number; w: number; h: number; animate: boolean };

/** Tracks the selected child's box inside `box`; the first placement doesn't animate. */
function useSlidingMark(box: React.RefObject<HTMLDivElement | null>) {
  const [mark, setMark] = useState<Mark | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const sel = el.querySelector<HTMLElement>(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
      if (!sel || !sel.offsetWidth) return setMark(null);
      const next = { x: sel.offsetLeft, y: sel.offsetTop, w: sel.offsetWidth, h: sel.offsetHeight };
      setMark((m) => (m && m.x === next.x && m.y === next.y && m.w === next.w && m.h === next.h ? m : { ...next, animate: !!m }));
    };
    place();
    const watch = new MutationObserver(place);
    watch.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected"] });
    // Pills can change width without the group doing so (fonts loading, translations). Absent in jsdom.
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    for (const n of [el, ...el.children]) resize?.observe(n);
    return () => {
      watch.disconnect();
      resize?.disconnect();
    };
  }, [box]);
  return mark;
}

/** One segment: accent fill when active (`quiet`: neutral, for a bare group). Inside a measured group the fill
 *  moves to the group's sliding highlight. Uses aria-pressed, or aria-selected in a tablist. */
export function Pill({
  active,
  tab,
  quiet,
  className = "",
  children,
  ...rest
}: { active: boolean; tab?: boolean; quiet?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role={tab ? "tab" : undefined}
      aria-selected={tab ? active : undefined}
      aria-pressed={tab ? undefined : active}
      className={
        "relative cursor-pointer rounded-md border-none transition-[color,background-color,transform] duration-200 active:scale-[.97] " +
        (active
          ? (quiet ? "bg-chip text-text " : "bg-accent text-on-accent ") + "group-data-slid/pills:bg-transparent "
          : "bg-transparent text-muted hover:bg-wc hover:text-text ") +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}

/** Hover and press feedback shared by the bordered neutral buttons. */
const neutralFeedback =
  "transition-[color,border-color,background-color,transform] duration-200 not-disabled:hover:border-wi not-disabled:hover:text-text not-disabled:active:translate-y-px";

/** Small bordered button used in top bars (Sign out, Settings). */
export const chipButton =
  "cursor-pointer rounded-[7px] border border-wd bg-topchip px-2.5 py-[7px] text-xs text-muted disabled:cursor-not-allowed disabled:opacity-50 " +
  neutralFeedback;

/** Larger neutral button next to an accent one (e.g. "Load starter set"). */
export const secondaryButton = "cursor-pointer rounded-[9px] border border-wf bg-topchip font-semibold text-muted " + neutralFeedback;

/** Neutral action inside panels and dialogs (Cancel, Share, Download). */
export const neutralButton = "cursor-pointer rounded-[9px] border border-wf bg-chip font-semibold text-text2 " + neutralFeedback;

/** Main action. Dims and stops reacting when disabled or aria-disabled. */
export const accentButton =
  "cursor-pointer rounded-[9px] border-none bg-accent font-semibold text-on-accent transition-[filter,transform,opacity] duration-200 " +
  "not-disabled:not-aria-disabled:hover:brightness-110 not-disabled:not-aria-disabled:active:scale-[.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Destructive button; `confirming` is the armed second step (filled). */
export const dangerButton = (confirming: boolean) =>
  "cursor-pointer border font-semibold transition-[color,background-color,border-color,filter,transform] duration-200 active:translate-y-px " +
  (confirming ? "border-neg bg-neg text-on-accent hover:brightness-110" : "border-neg/40 bg-transparent text-neg hover:border-neg hover:bg-neg/10");

/** On/off chip used in pickers and filters. `off` sets the resting look. */
export const toggleChip = (on: boolean, off = "border-wf bg-chip text-text2") =>
  "cursor-pointer border transition-[color,background-color,border-color,transform] duration-200 active:scale-[.97] " +
  (on ? "border-accent bg-accent text-on-accent" : off + " hover:border-wi hover:text-text");

/** Icon-only close button in dialog headers. */
export const closeButton =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted transition-colors duration-150 hover:bg-wc hover:text-text";
