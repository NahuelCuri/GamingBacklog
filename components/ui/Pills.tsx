"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Segmented control container (legacy: topchip bg, 9px radius, 3px inset). */
export function PillGroup({
  children,
  label,
  role = "group",
  className = "",
  style,
}: {
  children: ReactNode;
  label?: string;
  role?: "group" | "tablist";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div role={role} aria-label={label} className={"flex gap-[3px] rounded-[9px] border border-wd bg-topchip p-[3px] " + className} style={style}>
      {children}
    </div>
  );
}

/** One segment: accent fill when active. Uses aria-pressed, or aria-selected in a tablist. */
export function Pill({
  active,
  tab,
  className = "",
  children,
  ...rest
}: { active: boolean; tab?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role={tab ? "tab" : undefined}
      aria-selected={tab ? active : undefined}
      aria-pressed={tab ? undefined : active}
      className={
        "cursor-pointer rounded-md border-none transition-[color,background-color,transform] duration-200 active:scale-[.97] " +
        (active ? "bg-accent text-on-accent " : "bg-transparent text-muted hover:bg-wc hover:text-text ") +
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
