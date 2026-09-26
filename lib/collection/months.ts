// Months tab (finance): per-month summary cards plus the drill-down for one
// month (calendar, category breakdown, transactions).
import { usd, type MoneyFormat } from "@/lib/spending";
import { ACC, MON, fitFont, heatColor, monthKey, monthLabel, pct, priceOf, ymd } from "./format";
import type { CollectionConfig, Item } from "./types";

const CARD: [number, string][] = [[8, "17px"], [10, "15px"], [12, "13px"], [99, "12px"]];
const CARD_SM: [number, string][] = [[8, "14px"], [11, "12px"], [99, "11px"]];
const DRILL: [number, string][] = [[6, "24px"], [8, "21px"], [10, "18px"], [12, "16px"], [99, "14px"]];

const NEGATIVE = "#d98f8f";
const num = (v: unknown) => Number(v) || 0;

export interface MonthCard {
  key: string;
  label: string;
  spent: string;
  income: string;
  saved: string;
  spentSize: string;
  incomeSize: string;
  savedSize: string;
  savedColor: string;
  txns: string;
  topCategory: string;
  biggest: string;
  biggestAmt: string;
}

export interface CalendarCell {
  blank?: true;
  day?: string;
  spend?: number;
  has?: boolean;
  tip?: string;
  color?: string;
}

export interface MonthTxn {
  id: string;
  date: string;
  title: string;
  category: string;
  notes: string;
  amount: string;
  color: string;
}

export interface MonthDetail {
  key: string;
  label: string;
  spent: string;
  income: string;
  saved: string;
  spentSize: string;
  incomeSize: string;
  savedSize: string;
  savedColor: string;
  txnCount: string;
  topCategory: string;
  weekLabels: string[];
  cells: CalendarCell[];
  categories: { label: string; val: string; pct: string }[];
  txns: MonthTxn[];
}

/** Items grouped by YYYY-MM of their date; undated items are skipped. */
export function groupByMonth(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {};
  items.forEach((x) => {
    const k = monthKey(x.date);
    if (k) (groups[k] = groups[k] || []).push(x);
  });
  return groups;
}

function helpers(cfg: CollectionConfig) {
  const pf = priceOf(cfg), sf = cfg.statusField;
  const sumType = (list: Item[], t: string) => list.filter((x) => x[sf] === t).reduce((a, b) => a + num(b[pf]), 0);
  const expenses = (list: Item[]) => list.filter((x) => x[sf] === "expense");
  const byCategory = (list: Item[]) => {
    const c: Record<string, number> = {};
    expenses(list).forEach((x) => {
      const k = (x.category as string) || "Other";
      c[k] = (c[k] || 0) + num(x[pf]);
    });
    return c;
  };
  const topCat = (list: Item[]) => Object.entries(byCategory(list)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  return { pf, sf, sumType, expenses, byCategory, topCat };
}

export function monthCards(cfg: CollectionConfig, items: Item[], m: MoneyFormat = usd): MonthCard[] {
  const { pf, sumType, expenses, topCat } = helpers(cfg);
  const titleKey = cfg.modal.titleField;
  const groups = groupByMonth(items);
  return Object.keys(groups)
    .sort()
    .reverse()
    .map((k) => {
      const list = groups[k], spent = sumType(list, "expense"), income = sumType(list, "income");
      const big = expenses(list).sort((a, b) => num(b[pf]) - num(a[pf]))[0];
      return {
        key: k, label: monthLabel(k),
        spent: m.money(spent), income: m.money(income), saved: m.money(income - spent),
        spentSize: fitFont(m.money(spent), CARD), incomeSize: fitFont(m.money(income), CARD), savedSize: fitFont(m.money(income - spent), CARD_SM),
        savedColor: income - spent >= 0 ? ACC : NEGATIVE,
        txns: String(list.length), topCategory: topCat(list),
        biggest: big ? String(big[titleKey] ?? "") : "—", biggestAmt: big ? m.money(big[pf]) : "",
      };
    });
}

export function monthDetail(cfg: CollectionConfig, items: Item[], key: string, m: MoneyFormat = usd): MonthDetail | null {
  const groups = groupByMonth(items);
  if (!groups[key]) return null;
  const { pf, sf, sumType, expenses, byCategory, topCat } = helpers(cfg);
  const titleKey = cfg.modal.titleField;
  const list = groups[key].slice().sort((a, b) => ymd(b.date).localeCompare(ymd(a.date)));
  const spent = sumType(list, "expense"), income = sumType(list, "income");

  const [yy, mm] = key.split("-").map(Number);
  const firstDow = new Date(yy, mm - 1, 1).getDay();
  const daysIn = new Date(yy, mm, 0).getDate();
  const byDay: Record<number, number> = {};
  expenses(list).forEach((x) => {
    const d = +ymd(x.date).slice(8, 10);
    byDay[d] = (byDay[d] || 0) + num(x[pf]);
  });
  const maxV = Math.max(1, ...Object.values(byDay));
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ blank: true });
  for (let d = 1; d <= daysIn; d++) {
    const v = byDay[d] || 0;
    cells.push({ day: String(d), spend: v, has: v > 0, tip: v ? m.money(v) : "", color: heatColor(v / maxV, "var(--wb)") });
  }

  const catSums = byCategory(list);
  const catKeys = Object.keys(catSums).sort((a, b) => catSums[b] - catSums[a]);
  const catMax = Math.max(1, ...catKeys.map((c) => catSums[c]));

  return {
    key, label: monthLabel(key),
    spent: m.money(spent), income: m.money(income), saved: m.money(income - spent),
    spentSize: fitFont(m.money(spent), DRILL), incomeSize: fitFont(m.money(income), DRILL), savedSize: fitFont(m.money(income - spent), DRILL),
    savedColor: income - spent >= 0 ? ACC : NEGATIVE,
    txnCount: String(list.length), topCategory: topCat(list),
    weekLabels: ["S", "M", "T", "W", "T", "F", "S"],
    cells,
    categories: catKeys.map((c) => ({ label: c, val: m.money(catSums[c]), pct: pct(catSums[c], catMax) })),
    txns: list.map((x) => {
      const t = x[sf];
      const day = ymd(x.date);
      return {
        id: x.id,
        date: MON[+day.slice(5, 7) - 1] + " " + +day.slice(8, 10),
        title: String(x[titleKey] ?? ""),
        category: (x.category as string) || "—",
        notes: (x.notes as string) || "",
        amount: (t === "income" ? "+" : t === "expense" ? "−" : "") + m.money(x[pf]),
        color: t === "income" ? ACC : t === "expense" ? NEGATIVE : "var(--muted)",
      };
    }),
  };
}
