// Small pure helpers shared by every collection (legacy-src/collection-lib.js).
import type { CollectionConfig, Cond, Item } from "./types";

export const ACC = "var(--accent)";

export const fmt = (n: unknown) => Number(n).toLocaleString("en-US");

export const isEmpty = (v: unknown) => v == null || v === "";

/** Resolve a `{token}` url template against an item: "…?q={title}" → "…?q=Hades". */
export const linkUrl = (tpl: string, item: Record<string, unknown>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(item[k] == null ? "" : String(item[k])));

/** Conditional-visibility test. A missing condition always matches. */
export function condMatch(cond: Cond | undefined | null, item: Record<string, unknown> | null | undefined): boolean {
  if (!cond) return true;
  const v = item ? item[cond.field] : undefined;
  if ("eq" in cond) return v === cond.eq;
  if ("neq" in cond) return v !== cond.neq;
  if ("in" in cond) return cond.in.includes(v);
  if ("notIn" in cond) return !cond.notIn.includes(v);
  return true;
}

/** Key of the table's primary (title) column. */
export const primaryKey = (cfg: CollectionConfig) => cfg.table.columns.find((c) => c.primary)?.key ?? "title";

/** Field holding the money amount. */
export const priceOf = (cfg: CollectionConfig) => cfg.fields?.price || "price";

/** `item[field]` as a trimmed string ('' for null). */
export const str = (item: Item, field: string) => (item[field] == null ? "" : String(item[field]));

// ---------------------------------------------------------------- dates

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ymd = (d: unknown) => (d == null ? "" : String(d).slice(0, 10));
/** "2026-07-14" → "2026-07" */
export const monthKey = (d: unknown) => ymd(d).slice(0, 7);
/** "2026-07" → "Jul 2026" */
export const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return MON[+m - 1] + " " + y;
};
/** "2026-07" → "Jul '26" */
export const monthShort = (k: string) => {
  const [y, m] = k.split("-");
  return MON[+m - 1] + " '" + String(y).slice(2);
};
/** Local-time Date from a YYYY-MM-DD prefix, or null. */
export const dnum = (d: unknown) => {
  const p = ymd(d).split("-");
  return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
};
/** Local-time YYYY-MM-DD. */
export const isoDay = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

// ---------------------------------------------------------------- display

/** Length-responsive font size: first step whose max length fits; last step is the floor. */
export function fitFont(value: unknown, steps: [number, string][]): string {
  const n = String(value == null ? "" : value).length;
  for (const s of steps) if (n <= s[0]) return s[1];
  return steps[steps.length - 1][1];
}

export const SUMMARY_STEPS: [number, string][] = [[5, "26px"], [6, "24px"], [8, "20px"], [10, "16px"], [12, "14px"], [99, "12px"]];

/** Auto palette for data-derived buckets: even hue spread at fixed lightness/chroma. */
const DYN_HUES = [40, 150, 255, 300, 90, 200, 20, 125, 270, 340, 65, 175];
export const dynColors = (n: number) =>
  Array.from({ length: n }, (_, i) => `oklch(0.72 0.11 ${DYN_HUES[i % DYN_HUES.length]})`);

/** Accent-tinted fill for an intensity 0..1 (heatmaps, calendars); `empty` when ≤ 0. */
export const heatColor = (ratio: number, empty: string) =>
  ratio <= 0 ? empty : `color-mix(in srgb, var(--accent) ${18 + Math.round(ratio * 72)}%, transparent)`;

/** Histogram bar tint by bucket (1..10 score scale). */
export const bucketColor = (i: number) =>
  i >= 9 ? ACC : i >= 7 ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "color-mix(in srgb, var(--accent) 28%, transparent)";

export const pct = (v: number, max: number) => Math.round((v / max) * 100) + "%";
