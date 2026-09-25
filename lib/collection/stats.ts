// Stats: summary metrics and the data behind every stats widget. Widgets carry
// their spec so the component can read presentation options (barColor,
// compact, …); this module only computes values.
import { donutFromParts, spend, usd, type MoneyFormat } from "@/lib/spending";
import {
  ACC, MON, SUMMARY_STEPS, bucketColor, dnum, dynColors, fitFont, fmt, heatColor, isoDay, monthKey, monthShort,
  pct, priceOf, primaryKey, ymd,
} from "./format";
import { statusMeta } from "./library";
import type {
  BarListSpec, ByYearSpec, CollectionConfig, HeatmapSpec, HistogramSpec, Item, MetricSpec, MoneyDonutGroup,
  MoneyDonutSpec, StatusDonutSpec, SumBarsSpec, TagRatingSpec, TrendSpec, WeekdaySpec, WidgetSpec,
} from "./types";

export interface StatsContext {
  /** Active accent color, substituted for `{accent}` in donut segments. */
  accent: string;
  /** Year filter for money donuts ('all' or a year). */
  spendYear?: string;
  money?: MoneyFormat;
}

const num = (v: unknown) => Number(v) || 0;

// ---------------------------------------------------------------- metrics

export interface Metric {
  value: string;
  num: number;
}

export function metric(cfg: CollectionConfig, items: Item[], spec: MetricSpec, m: MoneyFormat = usd): Metric {
  const total = items.length;
  const sf = cfg.statusField, pf = priceOf(cfg);
  const sumType = (t: string) => items.filter((x) => x[sf] === t).reduce((a, b) => a + num(b[pf]), 0);
  switch (spec.kind) {
    case "count":
      return { value: fmt(total), num: total };
    case "statusCount": {
      const n = items.filter((x) => x[sf] === spec.status).length;
      return { value: fmt(n), num: n };
    }
    case "boolCount": {
      const n = items.filter((x) => x[spec.field]).length;
      return { value: fmt(n), num: n };
    }
    case "sum": {
      const s = items.map((x) => x[spec.field] as number).filter((v) => v != null).reduce((a, b) => a + b, 0);
      return { value: fmt(s), num: s };
    }
    case "avg": {
      const a = items.map((x) => x[spec.field] as number).filter((v) => v != null);
      const v = a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      return { value: v.toFixed(1), num: v };
    }
    case "completion": {
      const n = items.filter((x) => x[sf] === spec.status).length;
      const v = total ? Math.round((n / total) * 100) : 0;
      return { value: v + "%", num: v };
    }
    case "moneySum": {
      const s = spend(items, spec.match || spec.bool || "all", pf);
      return { value: m.money(s), num: s };
    }
    case "net": {
      const v = sumType("income") - sumType("expense");
      return { value: m.money(v), num: v };
    }
    case "savingsRate": {
      const inc = sumType("income");
      const v = inc > 0 ? Math.round(((inc - sumType("expense")) / inc) * 100) : 0;
      return { value: v + "%", num: v };
    }
    case "avgPerDay": {
      const days = new Set(items.filter((x) => x[sf] === "expense" && x.date).map((x) => ymd(x.date)));
      const v = days.size ? sumType("expense") / days.size : 0;
      return { value: m.money(v), num: v };
    }
    case "maxAmount": {
      const v = Math.max(0, ...items.filter((x) => x[sf] === "expense").map((x) => num(x[pf])));
      return { value: m.money(v), num: v };
    }
    case "accountSum": {
      const af = cfg.accountField || "account";
      const ex = spec.exclude || [];
      const v = items
        .filter((x) => {
          if (x[sf] !== "transfer") return false;
          const acct = x[af] as string;
          return spec.account ? acct === spec.account : !!acct && acct !== "None" && !ex.includes(acct);
        })
        .reduce((a, b) => a + num(b[pf]), 0);
      return { value: m.money(v), num: v };
    }
  }
}

export interface SummaryCard {
  label: string;
  value: string;
  accent: boolean;
  color?: string;
  /** length-fitted font size for the big number */
  size: string;
}

export function summaryCards(cfg: CollectionConfig, items: Item[], specs: MetricSpec[], m: MoneyFormat = usd): SummaryCard[] {
  return specs.map((spec) => {
    const { value } = metric(cfg, items, spec, m);
    return { label: spec.label, value, accent: !!spec.accent, color: spec.color, size: fitFont(value, SUMMARY_STEPS) };
  });
}

// ---------------------------------------------------------------- widgets

export interface BarRow {
  label: string;
  val: string;
  pct: string;
  rank?: string;
}

export interface PodiumEntry {
  rank: number;
  title: string;
  score: number;
}

export type Widget =
  | { kind: "barList"; spec: WidgetSpec; title: string; rows: BarRow[]; showRank: boolean; podium: PodiumEntry[] }
  | { kind: "histogram"; spec: HistogramSpec; title: string; bars: { label: number; count: number; pct: string; color: string }[] }
  | { kind: "byYear"; spec: ByYearSpec; title: string; bars: { label: string; count: number; pct: string }[] }
  | {
      kind: "statusDonut"; spec: StatusDonutSpec; title: string; donut: string; centerValue: string; centerLabel: string;
      legend: { color: string; label: string; count: number }[];
    }
  | {
      kind: "moneyDonut"; spec: MoneyDonutSpec; title: string; donut: string; centerValue: string; centerLabel: string;
      centerSize: string; year: string; yearOptions: { value: string; label: string }[];
      legend: { color: string; label: string; amount: string }[];
    }
  | { kind: "trend"; spec: TrendSpec; title: string; bars: { label: string; amount: string; pct: string }[]; empty: boolean }
  | {
      kind: "heatmap"; spec: HeatmapSpec; title: string; monthCols: string[];
      weeks: { col: { color: string; title: string; future: boolean }[] }[];
    };

function barList(cfg: CollectionConfig, items: Item[], spec: BarListSpec): Widget | null {
  const primary = primaryKey(cfg);
  if (spec.where) items = items.filter((x) => x[spec.where!.field] === spec.where!.eq);
  let rows: BarRow[];
  let podium: PodiumEntry[] = [];
  if (spec.field.startsWith("#")) {
    const f = spec.field.slice(1);
    const counts: Record<string, number> = {};
    items.forEach((x) => {
      const v = x[f];
      if (Array.isArray(v)) v.forEach((t: string) => (counts[t] = (counts[t] || 0) + 1));
      else {
        const s = (v == null ? "" : String(v)).trim();
        if (s) counts[s] = (counts[s] || 0) + 1;
      }
    });
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, spec.top);
    const maxV = Math.max(1, ...keys.map((k) => counts[k]));
    rows = keys.map((k) => ({ label: k, val: String(counts[k]), pct: pct(counts[k], maxV) }));
  } else {
    const f = spec.field;
    let list = items.filter((x) => x[f] != null);
    if (spec.money2) list = list.filter((x) => Number(x[f]) > 0);
    list = list.sort((a, b) => (spec.dir === "asc" ? (a[f] as number) - (b[f] as number) : (b[f] as number) - (a[f] as number))).slice(0, spec.top);
    const maxV = Math.max(1, spec.scale ? spec.scale : list.length ? (list[0][f] as number) : 1);
    rows = list.map((x, i) => {
      const v = x[f] as number;
      const val = spec.money2 ? "$" + Number(v).toFixed(2) : String(v) + (spec.suffix || "");
      return { rank: String(i + 1), label: String(x[primary] ?? ""), val, pct: pct(v, maxV) };
    });
    if (spec.podium) {
      const p = list.slice(0, 3).map((g, i) => ({ rank: i + 1, title: String(g[primary] ?? ""), score: g[f] as number }));
      // 2nd · 1st · 3rd, the winner in the middle
      podium = p.length === 3 ? [p[1], p[0], p[2]] : p;
    }
  }
  if (spec.hideWhenEmpty && rows.length === 0) return null;
  return { kind: "barList", spec, title: spec.title, rows, showRank: !!spec.podium, podium };
}

function histogram(items: Item[], spec: HistogramSpec): Widget {
  const n = spec.buckets || 10;
  const dist: Record<number, number> = {};
  for (let i = 1; i <= n; i++) dist[i] = 0;
  items.filter((x) => x[spec.field] != null).forEach((x) => dist[Math.max(1, Math.min(n, Math.round(x[spec.field] as number)))]++);
  const maxD = Math.max(1, ...Object.values(dist));
  const bars = [];
  for (let i = 1; i <= n; i++) bars.push({ label: i, count: dist[i], pct: pct(dist[i], maxD), color: bucketColor(i) });
  return { kind: "histogram", spec, title: spec.title, bars };
}

function byYear(items: Item[], spec: ByYearSpec): Widget {
  const yc: Record<string, number> = {};
  items.forEach((g) => {
    let y = g[spec.field] as string | undefined;
    if (spec.fromDate && y) y = String(y).slice(0, 4);
    if (y) yc[y] = (yc[y] || 0) + 1;
  });
  const maxY = Math.max(1, ...Object.values(yc));
  const bars = Object.keys(yc).sort().map((y) => ({ label: y, count: yc[y], pct: pct(yc[y], maxY) }));
  return { kind: "byYear", spec, title: spec.title, bars };
}

/** Tags ranked by average rating among rated items, with a minimum item count. */
function tagRating(cfg: CollectionConfig, items: Item[], spec: TagRatingSpec): Widget | null {
  const tf = spec.tag || cfg.tagField;
  const rf = spec.field || cfg.fields?.score || "score";
  const scale = spec.scale || 10, minCount = spec.minCount || 1;
  const rows = tagAverages(items, tf, rf)
    .filter((k) => k.cnt >= minCount)
    .slice(0, spec.top || 8)
    .map((k) => ({ label: k.tag + " · " + k.cnt, val: "★" + k.avg.toFixed(1), pct: pct(k.avg, scale) }));
  if (spec.hideWhenEmpty && !rows.length) return null;
  return { kind: "barList", spec, title: spec.title, rows, showRank: false, podium: [] };
}

/** Per tag: average of `ratingField` over items carrying it, best first (ties: more items). */
export function tagAverages(items: Item[], tagField: string, ratingField: string) {
  const agg: Record<string, { sum: number; n: number; cnt: number }> = {};
  items.forEach((x) => {
    const r = x[ratingField] as number | null | undefined;
    ((x[tagField] as string[]) || []).forEach((t) => {
      const a = agg[t] || (agg[t] = { sum: 0, n: 0, cnt: 0 });
      a.cnt++;
      if (r != null) {
        a.sum += r;
        a.n++;
      }
    });
  });
  return Object.keys(agg)
    .filter((t) => agg[t].n > 0)
    .map((t) => ({ tag: t, avg: agg[t].sum / agg[t].n, cnt: agg[t].cnt }))
    .sort((a, b) => b.avg - a.avg || b.cnt - a.cnt);
}

function statusDonut(cfg: CollectionConfig, items: Item[], spec: StatusDonutSpec, ctx: StatsContext): Widget {
  const total = items.length;
  const sub = (c: string) => c.replace("{accent}", ctx.accent);
  const segs = spec.segments.map((sg) => ({
    count: items.filter((x) => x[cfg.statusField] === sg.status).length,
    color: sub(sg.color),
    legendColor: sub(sg.legendColor || sg.color),
    label: statusMeta(cfg, sg.status).label,
  }));
  const centerCount = items.filter((x) => x[cfg.statusField] === spec.center.status).length;
  return {
    kind: "statusDonut", spec, title: spec.title,
    donut: donutFromParts(segs.map((s) => ({ value: s.count, color: s.color }))),
    centerValue: (total ? Math.round((centerCount / total) * 100) : 0) + "%",
    centerLabel: spec.center.label,
    legend: segs.map((s) => ({ color: s.legendColor, label: s.label, count: s.count })),
  };
}

/** Slices from the distinct values of a field; past `top` folds into "Other". */
function dynamicGroups(items: Item[], field: string, pf: string, top: number): MoneyDonutGroup[] {
  const sums: Record<string, number> = {};
  items.forEach((x) => {
    const k = (x[field] == null ? "" : String(x[field]).trim()) || "Other";
    sums[k] = (sums[k] || 0) + num(x[pf]);
  });
  const keys = Object.keys(sums).filter((k) => sums[k] > 0).sort((a, b) => sums[b] - sums[a]);
  const shown = keys.slice(0, top);
  const palette = dynColors(shown.length);
  const groups: MoneyDonutGroup[] = shown.map((k, i) => ({ label: k, match: { field, eq: k }, color: palette[i] }));
  if (keys.length > top) groups.push({ label: "Other", match: { field, in: keys.slice(top) }, color: "oklch(0.62 0.03 200)" });
  return groups;
}

function moneyDonut(cfg: CollectionConfig, items: Item[], spec: MoneyDonutSpec, ctx: StatsContext): Widget {
  const m = ctx.money ?? usd;
  const yf = spec.yearFilter, year = ctx.spendYear || "all";
  const yearsAvail = [...new Set(items.map((g) => g[yf]).filter(Boolean).map(String))].sort().reverse();
  const scoped = year === "all" ? items : items.filter((g) => String(g[yf]) === year);
  const pf = priceOf(cfg);
  let groups = spec.groups || [];
  if (spec.dynamicGroup) {
    const base = spec.type ? scoped.filter((x) => x[cfg.statusField] === spec.type) : scoped;
    groups = dynamicGroups(base, spec.dynamicGroup, pf, spec.top || 8);
  }
  const parts = groups.map((gr) => ({ value: spend(scoped, gr.match || gr.bool || "all", pf), color: gr.color, label: gr.label }));
  const total = parts.reduce((a, p) => a + p.value, 0);
  const centerValue = m.money(total);
  return {
    kind: "moneyDonut", spec, title: spec.title,
    donut: donutFromParts(parts),
    centerValue, centerLabel: spec.centerLabel || "spent",
    centerSize: fitFont(centerValue, [[6, "19px"], [9, "16px"], [12, "13px"], [99, "12px"]]),
    year, yearOptions: [{ value: "all", label: "All" }, ...yearsAvail.map((y) => ({ value: y, label: y }))],
    legend: parts.map((p) => ({ color: p.color, label: p.label, amount: m.money(p.value) })),
  };
}

function sumBars(cfg: CollectionConfig, items: Item[], spec: SumBarsSpec, m: MoneyFormat): Widget | null {
  const pf = priceOf(cfg);
  const list = spec.type ? items.filter((x) => x[cfg.statusField] === spec.type) : items;
  const sums: Record<string, number> = {};
  list.forEach((x) => {
    const k = (x[spec.group] == null ? "" : String(x[spec.group]).trim()) || "—";
    sums[k] = (sums[k] || 0) + num(x[pf]);
  });
  const keys = Object.keys(sums).filter((k) => sums[k] > 0).sort((a, b) => sums[b] - sums[a]).slice(0, spec.top || 8);
  if (spec.hideWhenEmpty && !keys.length) return null;
  const maxV = Math.max(1, ...keys.map((k) => sums[k]));
  const rows = keys.map((k) => ({ label: k, val: m.money(sums[k]), pct: pct(sums[k], maxV) }));
  return { kind: "barList", spec, title: spec.title, rows, showRank: false, podium: [] };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Expense total per weekday, Monday first. */
function weekday(cfg: CollectionConfig, items: Item[], spec: WeekdaySpec, m: MoneyFormat): Widget {
  const pf = priceOf(cfg);
  const sums = [0, 0, 0, 0, 0, 0, 0];
  items
    .filter((x) => x[cfg.statusField] === "expense" && x.date)
    .forEach((x) => {
      const d = dnum(x.date);
      if (d) sums[d.getDay()] += num(x[pf]);
    });
  const maxV = Math.max(1, ...sums);
  const rows = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: WEEKDAYS[i], val: m.money(sums[i]), pct: pct(sums[i], maxV) }));
  return { kind: "barList", spec, title: spec.title, rows, showRank: false, podium: [] };
}

function trend(cfg: CollectionConfig, items: Item[], spec: TrendSpec, m: MoneyFormat): Widget {
  const pf = priceOf(cfg), type = spec.type || "expense";
  const sums: Record<string, number> = {};
  items
    .filter((x) => x[cfg.statusField] === type && x.date)
    .forEach((x) => {
      const k = monthKey(x.date);
      sums[k] = (sums[k] || 0) + num(x[pf]);
    });
  const keys = Object.keys(sums).sort().slice(-(spec.months || 12));
  const maxV = Math.max(1, ...keys.map((k) => sums[k]));
  const bars = keys.map((k) => ({ label: monthShort(k), amount: m.money(sums[k]), pct: pct(sums[k], maxV) }));
  return { kind: "trend", spec, title: spec.title, bars, empty: !keys.length };
}

/** GitHub-style calendar of daily expense, ending on the week of the latest entry. */
function heatmap(cfg: CollectionConfig, items: Item[], spec: HeatmapSpec, m: MoneyFormat, now: Date): Widget {
  const pf = priceOf(cfg);
  const byDay: Record<string, number> = {};
  items
    .filter((x) => x[cfg.statusField] === "expense" && x.date)
    .forEach((x) => {
      const k = ymd(x.date);
      byDay[k] = (byDay[k] || 0) + num(x[pf]);
    });
  const dates = Object.keys(byDay).sort();
  const weeksN = spec.weeks || 26;
  const end = dates.length ? dnum(dates[dates.length - 1])! : now;
  const endSat = new Date(end);
  endSat.setDate(endSat.getDate() + (6 - endSat.getDay()));
  const cur = new Date(endSat);
  cur.setDate(cur.getDate() - (weeksN * 7 - 1));
  const maxV = Math.max(1, ...Object.values(byDay));
  const weeks = [];
  const monthCols: string[] = [];
  let lastMon = -1;
  for (let w = 0; w < weeksN; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const iso = isoDay(cur);
      const v = byDay[iso] || 0;
      col.push({ color: heatColor(v / maxV, "var(--wc)"), title: iso + (v ? " · " + m.money(v) : ""), future: cur > end });
      if (d === 0) {
        const mo = cur.getMonth();
        monthCols.push(mo !== lastMon ? MON[mo] : "");
        lastMon = mo;
      }
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push({ col });
  }
  return { kind: "heatmap", spec, title: spec.title, weeks, monthCols };
}

export function buildWidget(cfg: CollectionConfig, items: Item[], spec: WidgetSpec, ctx: StatsContext, now = new Date()): Widget | null {
  const m = ctx.money ?? usd;
  switch (spec.kind) {
    case "barList": return barList(cfg, items, spec);
    case "sumBars": return sumBars(cfg, items, spec, m);
    case "weekday": return weekday(cfg, items, spec, m);
    case "trend": return trend(cfg, items, spec, m);
    case "heatmap": return heatmap(cfg, items, spec, m, now);
    case "histogram": return histogram(items, spec);
    case "byYear": return byYear(items, spec);
    case "tagRating": return tagRating(cfg, items, spec);
    case "statusDonut": return statusDonut(cfg, items, spec, ctx);
    case "moneyDonut": return moneyDonut(cfg, items, spec, ctx);
  }
}

export interface StatsData {
  summary: SummaryCard[];
  left: Widget[];
  right: Widget[];
}

export function buildStats(cfg: CollectionConfig, items: Item[], ctx: StatsContext, now = new Date()): StatsData {
  const build = (list: WidgetSpec[]) => list.map((s) => buildWidget(cfg, items, s, ctx, now)).filter((w): w is Widget => w !== null);
  return {
    summary: summaryCards(cfg, items, cfg.stats.summary, ctx.money),
    left: build(cfg.stats.left),
    right: build(cfg.stats.right),
  };
}

/** Compact one-liners under the library toolbar. */
export function buildStrip(cfg: CollectionConfig, items: Item[], m: MoneyFormat = usd) {
  return cfg.stats.strip.map((spec) => ({
    label: spec.label,
    value: metric(cfg, items, spec, m).value,
    color: spec.accent ? ACC : spec.color || "inherit",
  }));
}
