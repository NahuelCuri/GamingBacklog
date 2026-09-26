// Loads the legacy app's logic (legacy-src/*.js) into a Node VM so parity tests
// can compare it against the TypeScript port on the real seed data.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { CollectionKey, Item } from "@/lib/collection/types";

const SRC = path.join(__dirname, "..", "legacy-src");
const KEYS: CollectionKey[] = ["games", "books", "wines", "movies", "expenses"];

/* eslint-disable @typescript-eslint/no-explicit-any */
const ctx: any = { window: {} };
vm.createContext(ctx);
const run = (file: string) => vm.runInContext(fs.readFileSync(path.join(SRC, file), "utf8"), ctx, { filename: file });
run("spending.js");
run("collection-lib.js");
for (const k of KEYS) {
  run(`${k}-config.js`);
  run(`${k}-seed.js`);
}

export const legacyLib: any = ctx.window.CollectionLib;
export const legacySpending: any = ctx.window.SpendingSystem;
export const legacyConfigs: Record<CollectionKey, any> = ctx.window.COLLECTION_CONFIGS;
export const legacySeeds: Record<CollectionKey, any[]> = { ...ctx.window.COLLECTION_SEEDS, games: ctx.window.GAMES_SEED };

/** Cross-realm, handler-free copy of a legacy value (functions are dropped). */
export const plain = <T = any>(v: unknown): T => (v === undefined ? (v as T) : JSON.parse(JSON.stringify(v)));

/** `var(--x,#fallback)` → `var(--x)`: the port relies on tokens always being defined. */
export function normalize<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null).replace(/var\((--[\w-]+),[^)]*\)/g, "var($1)"));
}

export function seed(key: CollectionKey): Item[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "seeds", `${key}.json`), "utf8"));
}

export const ACCENT = "#9ce6b0";

/** Minimal stand-in for the legacy DCLogic component the builders read from. */
export function legacySelf(key: CollectionKey, items: Item[], state: Record<string, unknown> = {}) {
  const noop = () => {};
  return {
    CONFIG: legacyConfigs[key],
    props: { accent: ACCENT },
    state: {
      games: items, q: "", status: "all", catFilter: "all", tagFilters: [], sortKey: "default", sortDir: "asc",
      isMobile: false, spendYear: "all", expandedId: null, pendingDelete: null, showAllLedger: false,
      rmode: "filters", rStatus: "backlog", rLength: "any", rTags: [], rSearch: "", rPicked: [],
      reel: [], recent: [], winner: null, spinning: false, openMonth: null, exportSel: {},
      ...state,
    },
    setState: noop, toggleExpand: noop, openEdit: noop, openShareCard: noop, removeGame: noop, toggleCurrency: noop,
    spin: noop, startPlaying: noop, openExport: noop,
  };
}

export { KEYS };
