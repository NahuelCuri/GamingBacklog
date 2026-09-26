// Shared price / spending math, ported from legacy-src/spending.js.
// Base amounts are always stored in USD. The display currency is passed in
// explicitly (legacy used a mutable window.__CURRENCY global).
import type { Item, Selector } from "@/lib/collection/types";

export interface Currency {
  code: string;
  symbol: string;
  /** display units per 1 USD */
  rate: number;
}

export const USD: Currency = { code: "USD", symbol: "$", rate: 1 };

export const SPEND_COLORS = {
  bought: "oklch(0.74 0.1 85)",
  pirated: "oklch(0.66 0.13 25)",
  gamepass: "oklch(0.68 0.14 155)",
} as const;

export interface MoneyFormat {
  /** Rounded, thousands-separated: 1234.5 → "$1,235" */
  money(n: unknown): string;
  /** Two decimals, "—" for empty: 12.5 → "$12.50" */
  money2(n: unknown): string;
}

export function moneyFormat(cur: Currency = USD): MoneyFormat {
  const rate = cur.rate || 1;
  return {
    money: (n) => cur.symbol + Math.round((Number(n) || 0) * rate).toLocaleString("en-US"),
    money2: (n) =>
      n == null || n === ""
        ? "—"
        : cur.symbol +
          ((Number(n) || 0) * rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

export const usd = moneyFormat(USD);

/** Does an item match a money-bucket selector? */
export function matchSel(item: Item, sel: Selector): boolean {
  if (sel == null || sel === "all") return true;
  if (typeof sel === "string") return !!item[sel];
  const v = item[sel.field];
  if ("eq" in sel) return v === sel.eq;
  if (sel.in) return sel.in.includes(v);
  if (sel.notIn) return !sel.notIn.includes(v);
  return true;
}

/** Sum `priceField` across the items matching `sel`. */
export function spend(items: Item[], sel: Selector, priceField = "price"): number {
  return items
    .filter((x) => x[priceField] != null && matchSel(x, sel))
    .reduce((a, b) => a + Number(b[priceField]), 0);
}

/** conic-gradient for an ordered list of parts; a neutral fill when all are zero. */
export function donutFromParts(parts: { value: number; color: string }[]): string {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return "rgba(255,255,255,.07)";
  let acc = 0;
  const stops = parts.map((p) => {
    const a = (acc / total) * 100;
    acc += p.value;
    const b = (acc / total) * 100;
    return `${p.color} ${a}% ${b}%`;
  });
  return "conic-gradient(" + stops.join(", ") + ")";
}
