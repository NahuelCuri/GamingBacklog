// Library (table) logic: status/score styling, tags, filtering, sorting, the
// ledger month, paging and per-cell display values.
import { usd, type MoneyFormat } from "@/lib/spending";
import { ACC, condMatch, isEmpty, linkUrl, monthKey, primaryKey } from "./format";
import type { CollectionConfig, FilterChip, Item, StatusDef, TableColumn } from "./types";

export interface LibraryFilters {
  q: string;
  /** 'all' or a status/filter-chip value */
  status: string;
  catFilter?: string;
  tagFilters: string[];
  /** 'default' uses cfg.defaultSort (or insertion order) */
  sortKey: string;
  sortDir: "asc" | "desc";
}

export const DEFAULT_FILTERS: LibraryFilters = { q: "", status: "all", catFilter: "all", tagFilters: [], sortKey: "default", sortDir: "asc" };

export const ROW_PAGE = 150;

// ---------------------------------------------------------------- status / score

/** Status definition for a value, falling back to the default status. */
export function statusMeta(cfg: CollectionConfig, val: unknown): StatusDef {
  return (
    cfg.statuses.find((x) => x.value === val) ??
    cfg.statuses.find((x) => x.value === cfg.defaultStatus) ??
    cfg.statuses[cfg.statuses.length - 1]
  );
}

export function scoreColor(v: unknown): string {
  if (v == null) return "var(--dim)";
  const n = v as number;
  if (n >= 9) return ACC;
  if (n >= 7) return "var(--accent2)";
  if (n >= 5) return "var(--text2)";
  return "var(--muted)";
}

// ---------------------------------------------------------------- tags

const tagsOf = (item: Item, field: string) => (item[field] as string[] | undefined) ?? [];

export function allTags(cfg: CollectionConfig, items: Item[]): string[] {
  const s = new Set<string>();
  items.forEach((g) => tagsOf(g, cfg.tagField).forEach((t) => s.add(t)));
  return [...s];
}

export function tagCounts(cfg: CollectionConfig, items: Item[]): Record<string, number> {
  const c: Record<string, number> = {};
  items.forEach((g) => tagsOf(g, cfg.tagField).forEach((t) => (c[t] = (c[t] || 0) + 1)));
  return c;
}

/** Distinct category values actually used, most frequent first (dynamicCategories). */
export function categoryValues(cfg: CollectionConfig, items: Item[]): string[] {
  if (!cfg.categoryField) return [];
  const c: Record<string, number> = {};
  items.forEach((g) => {
    const v = String(g[cfg.categoryField!] ?? "").trim();
    if (v) c[v] = (c[v] || 0) + 1;
  });
  return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
}

// ---------------------------------------------------------------- filter / sort

/** Status-chip test shared by the toolbar and the roulette pool. */
export function chipMatch(cfg: CollectionConfig, chips: FilterChip[] | undefined, g: Item, value: string): boolean {
  if (value === "all") return true;
  const chip = (chips || []).find((c) => c.value === value);
  if (chip?.bool) return !!g[chip.bool];
  return g[cfg.statusField] === value;
}

export function matches(cfg: CollectionConfig, g: Item, st: LibraryFilters): boolean {
  if (!chipMatch(cfg, cfg.statusFilters, g, st.status)) return false;
  if (st.catFilter && st.catFilter !== "all" && cfg.categoryField) {
    if ((g[cfg.categoryField] == null ? "" : g[cfg.categoryField]) !== st.catFilter) return false;
  }
  for (const t of st.tagFilters) if (!tagsOf(g, cfg.tagField).includes(t)) return false;
  const q = (st.q || "").trim().toLowerCase();
  if (q) {
    const hay = cfg.searchFields
      .map((f) => (f === cfg.tagField ? tagsOf(g, f).join(" ") : g[f] == null ? "" : g[f]))
      .join(" ")
      .toLowerCase();
    for (const term of q.split(/\s+/)) if (!hay.includes(term)) return false;
  }
  return true;
}

/** Stable sort; empty values always last. Title sorts case-insensitively. */
export function sorted(cfg: CollectionConfig, list: Item[], st: Pick<LibraryFilters, "sortKey" | "sortDir">): Item[] {
  let k = st.sortKey;
  let dir = st.sortDir === "asc" ? 1 : -1;
  if (k === "default") {
    if (!cfg.defaultSort) return list;
    k = cfg.defaultSort.key;
    dir = cfg.defaultSort.dir === "asc" ? 1 : -1;
  }
  const primary = primaryKey(cfg);
  const val = (g: Item) => (k === primary ? String(g[k] || "").toLowerCase() : g[k]);
  return [...list].sort((a, b) => {
    const va = val(a) as string | number, vb = val(b) as string | number;
    const an = va == null || va === "", bn = vb == null || vb === "";
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

/** Next sort state when a header is clicked: same key flips, new key starts ascending. */
export function nextSort(cur: Pick<LibraryFilters, "sortKey" | "sortDir">, key: string) {
  return cur.sortKey === key
    ? { sortKey: key, sortDir: cur.sortDir === "asc" ? ("desc" as const) : ("asc" as const) }
    : { sortKey: key, sortDir: "asc" as const };
}

export interface VisibleRows {
  rows: Item[];
  more: { show: false } | { show: true; shown: number; total: number; remaining: number };
}

/** "YYYY-MM" of a local date (today by default). */
export const currentMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** "2026-01" shifted by `n` months: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(k: string, n: number): string {
  const [y, m] = k.split("-").map(Number);
  return currentMonthKey(new Date(y, m - 1 + n, 1));
}

/**
 * Months the ledger picker offers, newest first: the last `span` months up to
 * `current`, plus any month with rows in memory and the one being shown.
 */
export function ledgerMonths(items: Item[], current = currentMonthKey(), shown = current, span = 24): string[] {
  const s = new Set<string>([shown]);
  for (let i = 0; i < span; i++) s.add(shiftMonth(current, -i));
  items.forEach((g) => {
    const k = monthKey(g.date);
    if (k) s.add(k);
  });
  return [...s].sort().reverse();
}

/** Filter → sort → ledger month → paging. Ledger collections only ever show one month. */
export function visibleRows(
  cfg: CollectionConfig,
  items: Item[],
  st: LibraryFilters,
  opts: { month?: string; rowLimit?: number } = {},
): VisibleRows {
  const month = cfg.ledgerMonth ? opts.month || currentMonthKey() : null;
  const pool = month ? items.filter((g) => monthKey(g.date) === month) : items;
  let rows = sorted(cfg, pool.filter((g) => matches(cfg, g, st)), st);

  const limit = opts.rowLimit || ROW_PAGE;
  let more: VisibleRows["more"] = { show: false };
  if (rows.length > limit) {
    more = { show: true, shown: limit, total: rows.length, remaining: rows.length - limit };
    rows = rows.slice(0, limit);
  }
  return { rows, more };
}

// ---------------------------------------------------------------- cells

export type Cell =
  | { kind: "title"; text: string }
  | { kind: "tags"; tags: string[] }
  | { kind: "status"; meta: StatusDef }
  | { kind: "value"; text: string; color: string; strong: boolean };

export function cellValue(cfg: CollectionConfig, col: TableColumn, g: Item, m: MoneyFormat = usd): Cell {
  const v = g[col.key];
  if (col.primary) return { kind: "title", text: String(v ?? "") };
  if (col.kind === "tags") return { kind: "tags", tags: (v as string[]) || [] };
  if (col.kind === "status") return { kind: "status", meta: statusMeta(cfg, v) };
  if (col.kind === "money") {
    const t = g[cfg.statusField];
    const sign = t === "income" ? "+" : t === "expense" ? "−" : "";
    const color = t === "income" ? ACC : t === "expense" ? "#d98f8f" : "var(--muted)";
    return { kind: "value", text: sign + m.money(v), color, strong: true };
  }
  if (col.kind === "score") return { kind: "value", text: v == null ? "—" : String(v), color: scoreColor(v), strong: true };
  return { kind: "value", text: v == null ? "—" : v + (col.unit || ""), color: col.color || "var(--text2)", strong: false };
}

export interface DetailRow {
  label: string;
  value: string;
  link?: { url: string; title: string; pulse: boolean };
}

/** Expanded-row metadata grid. */
export function detailRows(cfg: CollectionConfig, g: Item, m: MoneyFormat = usd): DetailRow[] {
  return cfg.detail.fields
    .filter((f) => condMatch(f.showWhen, g))
    .map((f) => {
      const raw = g[f.key];
      let value: string;
      if (f.kind === "yesno") value = raw ? "Yes" : "No";
      else if (f.kind === "money2") value = m.money2(raw);
      else if (f.kind === "tags") {
        const arr = (raw as string[]) || [];
        value = arr.length ? arr.join(", ") : f.empty || "—";
      } else value = isEmpty(raw) ? f.empty || "—" : String(raw);
      const row: DetailRow = { label: f.label, value };
      if (f.searchLink) {
        row.link = { url: linkUrl(f.searchLink.url, g), title: f.searchLink.title, pulse: !!f.searchLink.pulseWhenEmpty && isEmpty(raw) };
      }
      return row;
    });
}

export function cornerLink(cfg: CollectionConfig, g: Item) {
  const cl = cfg.detail.cornerLink;
  if (!cl) return null;
  return { url: linkUrl(cl.url, g), label: cl.label, pulse: isEmpty(g[cl.field]) };
}

/** Review text for the expanded row, or null when empty. */
export function reviewOf(cfg: CollectionConfig, g: Item): string | null {
  const rv = g[cfg.detail.reviewField];
  return rv ? String(rv) : null;
}
