// View + filters live in the query string (legacy readUrl/syncUrl) so any
// filtered view is linkable and survives refresh and the back button.
import type { CollectionConfig } from "./types";

export type CollectionView = "library" | "stats" | "months" | "map" | "roulette";

export const VIEWS: CollectionView[] = ["library", "stats", "months", "map", "roulette"];

/** Does this collection have the tab? (`?view=map` on Games falls back to the library.) */
export function hasView(cfg: CollectionConfig, view: CollectionView): boolean {
  if (view === "months") return !!cfg.months;
  if (view === "map") return !!cfg.geo;
  if (view === "roulette") return !!cfg.roulette;
  return true;
}

export interface UrlState {
  view: CollectionView;
  q: string;
  status: string;
  catFilter: string;
  tagFilters: string[];
}

export const DEFAULT_URL_STATE: UrlState = { view: "library", q: "", status: "all", catFilter: "all", tagFilters: [] };

export function readUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const v = p.get("view") as CollectionView | null;
  return {
    view: v && VIEWS.includes(v) ? v : "library",
    q: p.get("q") || "",
    status: p.get("status") || "all",
    catFilter: p.get("cat") || "all",
    tagFilters: (p.get("tags") || "").split(",").filter(Boolean),
  };
}

/** Query string for a state, keeping unrelated params. Returns "" or "?…". */
export function writeUrlState(search: string, s: UrlState): string {
  const p = new URLSearchParams(search);
  ["view", "q", "status", "tags", "cat"].forEach((k) => p.delete(k));
  if (s.view !== "library") p.set("view", s.view);
  if (s.q) p.set("q", s.q);
  if (s.status && s.status !== "all") p.set("status", s.status);
  if (s.catFilter && s.catFilter !== "all") p.set("cat", s.catFilter);
  if (s.tagFilters.length) p.set("tags", s.tagFilters.join(","));
  const q = p.toString();
  return q ? "?" + q : "";
}

export const sameUrlState = (a: UrlState, b: UrlState) =>
  a.view === b.view && a.q === b.q && a.status === b.status && a.catFilter === b.catFilter && String(a.tagFilters) === String(b.tagFilters);
