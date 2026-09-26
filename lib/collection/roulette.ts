// Roulette: pool building, tag cloud, manual picks and the reel strip.
import { primaryKey } from "./format";
import { chipMatch, statusMeta, tagCounts } from "./library";
import type { CollectionConfig, Item } from "./types";

export interface RouletteState {
  /** 'filters' draws from the filtered library; 'picked' from a hand-picked list. */
  rmode: "filters" | "picked";
  rStatus: string;
  /** band option value, 'any' for no limit */
  rLength: string;
  rTags: string[];
  rPicked: string[];
}

export function defaultRouletteState(cfg: CollectionConfig): RouletteState {
  return { rmode: "filters", rStatus: cfg.roulette?.defaultStatus ?? "all", rLength: "any", rTags: [], rPicked: [] };
}

export function pool(cfg: CollectionConfig, items: Item[], st: RouletteState): Item[] {
  const r = cfg.roulette;
  if (st.rmode === "picked") return items.filter((g) => st.rPicked.includes(g.id));
  return items.filter((g) => {
    if (!chipMatch(cfg, r?.statusFilters, g, st.rStatus)) return false;
    if (r?.band && st.rLength !== "any") {
      const h = g[r.band.field] as number | null | undefined;
      if (h == null) return false;
      const opt = r.band.options.find((o) => o.value === st.rLength);
      if (opt) {
        if (opt.min != null && !(h > opt.min)) return false;
        if (opt.max != null && !(h <= opt.max)) return false;
      }
    }
    if (st.rTags.length && !st.rTags.some((t) => ((g[cfg.tagField] as string[]) || []).includes(t))) return false;
    return true;
  });
}

/** All tags with counts, most used first then alphabetical. */
export function tagCloud(cfg: CollectionConfig, items: Item[]): { tag: string; count: number }[] {
  const counts = tagCounts(cfg, items);
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((tag) => ({ tag, count: counts[tag] }));
}

/** Up to 8 not-yet-picked items whose title contains the search text. */
export function pickSuggestions(cfg: CollectionConfig, items: Item[], picked: string[], search: string): Item[] {
  const q = search.trim().toLowerCase();
  if (!q) return [];
  const primary = primaryKey(cfg);
  return items.filter((g) => !picked.includes(g.id) && String(g[primary] || "").toLowerCase().includes(q)).slice(0, 8);
}

/** Subtitle under a reel card: the first non-null `reelSub` field. */
export function reelSub(cfg: CollectionConfig, g: Item): string {
  for (const rs of cfg.roulette?.reelSub || []) {
    const v = g[rs.field];
    if (v != null) return rs.tpl.replace("{v}", String(v));
  }
  return "—";
}

export function reelCard(cfg: CollectionConfig, g: Item) {
  const sm = statusMeta(cfg, g[cfg.statusField]);
  return { title: String(g[primaryKey(cfg)] ?? ""), dot: sm.reelDot || sm.dot, glow: !!sm.reelGlow, sub: reelSub(cfg, g) };
}

/** Is the winner already in the start-action state (e.g. already "playing")? */
export function winnerActive(cfg: CollectionConfig, w: Item | null): boolean {
  const sa = cfg.roulette?.startAction;
  return !!(w && sa && w[sa.field] === sa.value);
}

export const REEL = { length: 54, winnerIndex: 46, stride: 162, itemWidth: 150 } as const;

/** Random reel strip with the winner at REEL.winnerIndex. */
export function reelStrip(poolItems: Item[], winner: Item, rand: () => number = Math.random): Item[] {
  return Array.from({ length: REEL.length }, (_, i) =>
    i === REEL.winnerIndex ? winner : poolItems[Math.floor(rand() * poolItems.length)],
  );
}

/** Final translateX of the strip so the winner lands under the marker (± jitter). */
export const reelTarget = (rand: () => number = Math.random) =>
  -(REEL.winnerIndex * REEL.stride + REEL.itemWidth / 2) + (rand() * 90 - 45);

export const pickRandom = <T,>(list: T[], rand: () => number = Math.random): T => list[Math.floor(rand() * list.length)];

/** Most-recent-first, deduped, capped at 6. */
export const pushRecent = (recent: Item[], w: Item) => [w, ...recent.filter((x) => x.id !== w.id)].slice(0, 6);
