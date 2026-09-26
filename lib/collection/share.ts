// Shareable images (legacy CollectionLib.buildShare / buildShareCard):
//  - stats image: pick modules, scope by year, render a 560px card
//  - item card: pick which of an item's fields appear on a 460px card
import { donutFromParts, spend, usd, type MoneyFormat } from "@/lib/spending";
import { ACC, bucketColor, condMatch, fmt, isEmpty, pct, primaryKey } from "./format";
import { scoreColor, statusMeta } from "./library";
import { metric, tagAverages } from "./stats";
import type { CollectionConfig, Item, ModalField, MoneyDonutSpec, StatusDonutSpec } from "./types";

// ================================================================ stats image

export type YearMode = "all" | "year" | "range";

export interface ShareScope {
  mode: YearMode;
  year: string;
  from: string;
  to: string;
}

/** Distinct values of the share year field, ascending. */
export const shareYears = (cfg: CollectionConfig, items: Item[]) =>
  [...new Set(items.map((g) => g[cfg.stats.shareYearField]).filter(Boolean).map(String))].sort();

/** Switching mode pre-fills an empty year (latest) or range (first → latest). */
export function withYearMode(cfg: CollectionConfig, items: Item[], s: ShareScope, mode: YearMode): ShareScope {
  const ys = shareYears(cfg, items);
  const next = { ...s, mode };
  if (mode === "year" && !s.year) next.year = ys.at(-1) ?? "";
  if (mode === "range") {
    if (!s.from) next.from = ys[0] ?? "";
    if (!s.to) next.to = ys.at(-1) ?? "";
  }
  return next;
}

export function scopeItems(cfg: CollectionConfig, items: Item[], s: ShareScope): { items: Item[]; label: string } {
  const yf = cfg.stats.shareYearField;
  if (s.mode === "year" && s.year) return { items: items.filter((x) => String(x[yf]) === String(s.year)), label: String(s.year) };
  if (s.mode === "range" && s.from && s.to) {
    const a = Math.min(+s.from, +s.to), b = Math.max(+s.from, +s.to);
    return { items: items.filter((x) => x[yf] && +(x[yf] as string) >= a && +(x[yf] as string) <= b), label: a === b ? String(a) : `${a}–${b}` };
  }
  return { items, label: "All time" };
}

export const defaultModuleSelection = (cfg: CollectionConfig) =>
  Object.fromEntries(cfg.stats.shareModules.map((m) => [m.key, m.default])) as Record<string, boolean>;

export interface ShareBarStyle {
  showRank: boolean;
  labelWidth: string;
  labelColor: string;
  labelSize: string;
  barOpacity: string;
  rowGap: string;
  valColor: string;
  valWidth: string;
  valSize: string;
  valWeight: string;
}

export type ShareBlock =
  | { kind: "cards"; key: string; title: string; cards: { value: string; label: string; color: string }[] }
  | { kind: "bar"; key: string; title: string; rows: { rank?: string; label: string; val: string; pct: string; barColor: string }[]; style: ShareBarStyle }
  | { kind: "histogram"; key: string; title: string; bars: { label: number; count: number; pct: string; color: string }[] }
  | { kind: "byYear"; key: string; title: string; bars: { label: string; count: number; pct: string }[] }
  | {
      kind: "spending"; key: string; title: string; has: boolean; total: string; donut: string; emptyMsg: string;
      legend: { label: string; amount: string; color: string }[];
    };

function barStyle(o: Partial<ShareBarStyle> & { labelWidth: string; valWidth: string }): ShareBarStyle {
  return {
    showRank: false, labelColor: "inherit", labelSize: "12.5px", barOpacity: "1", rowGap: "8px",
    valColor: "var(--text2)", valSize: "12px", valWeight: "600", ...o,
  };
}

const countRows = (counts: Record<string, number>, top: number) => {
  const max = Math.max(1, ...Object.values(counts));
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, top)
    .map((k) => ({ label: k, val: String(counts[k]), pct: pct(counts[k], max) }));
};

/** The selected modules, in config order, for already-scoped items. */
export function shareModules(
  cfg: CollectionConfig,
  g: Item[],
  selected: Record<string, boolean>,
  accent: string,
  m: MoneyFormat = usd,
): ShareBlock[] {
  const primary = primaryKey(cfg);
  const F = cfg.fields;
  const sf = cfg.statusField, yf = cfg.stats.shareYearField;
  const allW = [...cfg.stats.left, ...cfg.stats.right];
  const sd = allW.find((w): w is StatusDonutSpec => w.kind === "statusDonut");
  const md = allW.find((w): w is MoneyDonutSpec => w.kind === "moneyDonut");
  const total = g.length;
  const num = (x: Item, k: string) => x[k] as number;

  const byScore = g.filter((x) => x[F.score] != null).sort((a, b) => num(b, F.score) - num(a, F.score));
  const byHours = g.filter((x) => x[F.hours] != null).sort((a, b) => num(b, F.hours) - num(a, F.hours));
  const maxHours = byHours.length ? num(byHours[0], F.hours) : 1;

  const makers: Record<string, () => ShareBlock | null> = {
    summary: () => ({
      kind: "cards", key: "summary", title: "Overview",
      cards: cfg.stats.summary.map((spec) => ({ value: metric(cfg, g, spec, m).value, label: spec.label, color: spec.accent ? ACC : "var(--text)" })),
    }),
    topRated: () => {
      const rows = byScore.slice(0, 5).map((x, i) => ({ rank: String(i + 1), label: String(x[primary]), val: String(x[F.score]), pct: num(x, F.score) * 10 + "%", barColor: ACC }));
      return rows.length ? { kind: "bar", key: "topRated", title: "Highest rated", rows, style: barStyle({ showRank: true, labelWidth: "150px", valColor: ACC, valWidth: "24px" }) } : null;
    },
    mostPlayed: () => {
      const rows = byHours.slice(0, 5).map((x) => ({ label: String(x[primary]), val: x[F.hours] + "h", pct: pct(num(x, F.hours), maxHours), barColor: "#5b9e73" }));
      return rows.length ? { kind: "bar", key: "mostPlayed", title: "Most played · hours", rows, style: barStyle({ labelWidth: "170px", valWidth: "42px" }) } : null;
    },
    scoreDist: () => {
      const dist: Record<number, number> = {};
      for (let i = 1; i <= 10; i++) dist[i] = 0;
      byScore.forEach((x) => dist[Math.max(1, Math.min(10, Math.round(num(x, F.score))))]++);
      const max = Math.max(1, ...Object.values(dist));
      const bars = Array.from({ length: 10 }, (_, k) => k + 1).map((i) => ({ label: i, count: dist[i], pct: pct(dist[i], max), color: bucketColor(i) }));
      return { kind: "histogram", key: "scoreDist", title: "Score distribution", bars };
    },
    status: () => {
      const segs = sd?.segments ?? cfg.statuses.map((s) => ({ status: s.value, color: s.dot, legendColor: s.dot }));
      const rows = segs.map((seg) => {
        const count = g.filter((x) => x[sf] === seg.status).length;
        return {
          label: statusMeta(cfg, seg.status).label, val: String(count),
          barColor: (seg.legendColor || seg.color).replace("{accent}", accent),
          pct: (total ? Math.round((count / total) * 100) : 0) + "%",
        };
      });
      return { kind: "bar", key: "status", title: "Library status", rows, style: barStyle({ labelWidth: "74px", labelColor: "var(--text2)", rowGap: "9px", valWidth: "26px" }) };
    },
    spending: () => {
      // Money derives from the stats money donut, scoped to finished items.
      const base = g.filter((x) => x[sf] === "played");
      const parts = (md?.groups ?? []).map((gr) => ({ value: spend(base, gr.match || gr.bool || "all", F.price), color: gr.color, label: gr.label }));
      const sum = parts.reduce((a, p) => a + p.value, 0);
      return {
        kind: "spending", key: "spending", title: "Spending", has: sum > 0, total: m.money(sum), donut: donutFromParts(parts),
        emptyMsg: `No prices recorded for played ${cfg.nounPlural || "items"} in this range yet — add prices to see this.`,
        legend: parts.map((p) => ({ label: p.label, amount: m.money(p.value), color: p.color })),
      };
    },
    topTags: () => {
      const c: Record<string, number> = {};
      g.forEach((x) => ((x[cfg.tagField] as string[]) || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
      const rows = countRows(c, 6).map((r) => ({ ...r, barColor: ACC }));
      return rows.length
        ? { kind: "bar", key: "topTags", title: "Top tags", rows, style: barStyle({ labelWidth: "96px", labelSize: "12px", barOpacity: ".85", valColor: "var(--muted)", valWidth: "22px", valSize: "11.5px", valWeight: "400" }) }
        : null;
    },
    topTagsRated: () => {
      const rows = tagAverages(g, cfg.tagField, F.score)
        .slice(0, 10)
        .map((k) => ({ label: `${k.tag} · ${k.cnt}`, val: "★" + k.avg.toFixed(1), pct: pct(k.avg, 10), barColor: ACC }));
      return rows.length
        ? { kind: "bar", key: "topTagsRated", title: "Top tags by rating", rows, style: barStyle({ labelWidth: "150px", labelSize: "12px", barOpacity: ".9", valColor: ACC, valWidth: "42px" }) }
        : null;
    },
    platforms: () => {
      const c: Record<string, number> = {};
      g.forEach((x) => {
        const p = String(x[F.platform] || "").trim();
        if (p) c[p] = (c[p] || 0) + 1;
      });
      const rows = countRows(c, 6).map((r) => ({ ...r, barColor: "#7fb894" }));
      return rows.length
        ? { kind: "bar", key: "platforms", title: "Platforms", rows, style: barStyle({ labelWidth: "96px", labelSize: "12px", valColor: "var(--muted)", valWidth: "22px", valSize: "11.5px", valWeight: "400" }) }
        : null;
    },
    byYear: () => {
      const c: Record<string, number> = {};
      g.forEach((x) => {
        if (x[yf]) c[x[yf] as string] = (c[x[yf] as string] || 0) + 1;
      });
      const max = Math.max(1, ...Object.values(c));
      const bars = Object.keys(c).sort().map((y) => ({ label: y, count: c[y], pct: pct(c[y], max) }));
      return bars.length ? { kind: "byYear", key: "byYear", title: "Completed by year", bars } : null;
    },
  };

  return cfg.stats.shareModules
    .filter((mod) => selected[mod.key])
    .map((mod) => makers[mod.key]?.() ?? null)
    .filter((x): x is ShareBlock => x !== null);
}

// ================================================================ item card

/** Initial card fields: score, status, up to two other numbers, tags. */
export function defaultCardSelection(cfg: CollectionConfig, g: Item): Record<string, boolean> {
  const scoreKey = cfg.fields.score, priceKey = cfg.fields.price;
  const sel: Record<string, boolean> = {};
  if (g[scoreKey] != null) sel[scoreKey] = true;
  sel[cfg.statusField] = true;
  let n = 0;
  for (const k of cfg.modal.numberFields || []) {
    if (k !== scoreKey && k !== priceKey && g[k] != null && n < 2) {
      sel[k] = true;
      n++;
    }
  }
  if (((g[cfg.tagField] as unknown[]) || []).length) sel[cfg.tagField] = true;
  return sel;
}

const stripOptional = (s: string) => s.replace(/\s*\(optional\)/i, "");

/** Modal fields (bar the title) that this item has a value for, in visible groups. */
export function cardCandidates(cfg: CollectionConfig, g: Item): ModalField[] {
  const has = (f: ModalField) => {
    const v = g[f.key];
    if (f.kind === "tags") return Array.isArray(v) && v.length > 0;
    if (f.kind === "toggle") return !!v;
    return !isEmpty(v);
  };
  return cfg.modal.groups
    .filter((gr) => !gr.showWhen || condMatch(gr.showWhen, g))
    .flatMap((gr) => gr.fields)
    .filter((f) => f.key !== cfg.modal.titleField && has(f));
}

export interface ShareCardData {
  chips: { key: string; label: string; on: boolean }[];
  empty: boolean;
  title: string;
  score: { value: string; max: string; color: string; label: string } | null;
  status: { label: string; dot: string; glow: string; text: string } | null;
  stats: { label: string; value: string; color: string }[];
  tagGroups: { label: string; tags: string[] }[];
  review: { label: string; text: string } | null;
}

export function shareCard(cfg: CollectionConfig, g: Item, selected: Record<string, boolean>, m: MoneyFormat = usd): ShareCardData {
  const scoreKey = cfg.fields.score, priceKey = cfg.fields.price;
  const yearFields = cfg.modal.yearFields || [];
  const units: Record<string, string> = {};
  cfg.table.columns.forEach((c) => c.unit && (units[c.key] = c.unit));
  const maxes: Record<string, number> = {};
  cfg.modal.groups.forEach((gr) => gr.fields.forEach((f) => f.max != null && (maxes[f.key] = f.max)));

  const cand = cardCandidates(cfg, g);
  const chosen = cand.filter((f) => selected[f.key]);
  const fmtVal = (f: ModalField) => {
    const v = g[f.key];
    if (f.key === priceKey) return m.money2(v);
    if (f.kind === "toggle") return "Yes";
    if (f.kind === "tags") return ((v as string[]) || []).join(", ");
    if (yearFields.includes(f.key)) return String(v);
    if (f.kind === "number") return fmt(v) + (units[f.key] || "");
    return String(v);
  };

  const scoreF = chosen.find((f) => f.key === scoreKey);
  const statusF = chosen.find((f) => f.kind === "status");
  const reviewF = chosen.filter((f) => f.kind === "longtext");
  const sm = statusF ? statusMeta(cfg, g[cfg.statusField]) : null;

  return {
    chips: cand.map((f) => ({ key: f.key, label: stripOptional(f.label), on: !!selected[f.key] })),
    empty: chosen.length === 0,
    title: String(g[cfg.modal.titleField] || "Untitled"),
    score: scoreF
      ? { value: String(g[scoreKey]), max: maxes[scoreKey] != null ? "/ " + maxes[scoreKey] : "", color: scoreColor(g[scoreKey]), label: scoreF.label }
      : null,
    status: sm ? { label: sm.label, dot: sm.dot, glow: sm.glow, text: sm.text } : null,
    stats: chosen
      .filter((f) => f !== scoreF && !["status", "tags", "longtext"].includes(f.kind))
      .map((f) => ({ label: stripOptional(f.label), value: fmtVal(f), color: f.key === priceKey ? "oklch(0.8 0.09 85)" : "var(--text2)" })),
    tagGroups: chosen.filter((f) => f.kind === "tags").map((f) => ({ label: f.label, tags: (g[f.key] as string[]) || [] })),
    review: reviewF.length ? { label: stripOptional(reviewF[0].label), text: String(g[reviewF[0].key]) } : null,
  };
}

/** "games-baldurs-gate-3" */
export function cardFileName(cfg: CollectionConfig, g: Item | null) {
  const t = (g && g[cfg.modal.titleField]) || cfg.noun || "card";
  const slug = String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return (cfg.key || "backlog") + "-" + slug;
}
