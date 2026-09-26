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
      className={"cursor-pointer rounded-md border-none " + className}
      style={{ color: active ? "var(--onAccent)" : "var(--muted)", background: active ? "var(--accent)" : "transparent" }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Small bordered button used in top bars (Export, Import, Sign out). */
export const chipButton =
  "cursor-pointer rounded-[7px] border border-wd bg-topchip px-2.5 py-[7px] text-xs text-muted disabled:cursor-not-allowed disabled:opacity-50";

export const accentButton = "cursor-pointer rounded-[9px] border-none bg-accent font-semibold text-on-accent";
