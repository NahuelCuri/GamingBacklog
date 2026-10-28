// Yearly goals ("read 24 books in 2026"). The `goals` table holds only the
// target, one row per user, library and year (supabase/goals.sql); progress is
// always counted from the library, so editing a book moves the bar at once and
// a past year's result never drifts from what was read.
import type { SupabaseClient } from "@supabase/supabase-js";
import { condMatch, ymd } from "@/lib/collection/format";
import type { CollectionKey, GoalConfig, Item } from "@/lib/collection/types";

/** Target per year. */
export type Goals = Record<number, number>;

export interface GoalStore {
  load(collection: CollectionKey): Promise<Goals>;
  set(collection: CollectionKey, year: number, target: number): Promise<void>;
  remove(collection: CollectionKey, year: number): Promise<void>;
}

const fail = (error: unknown) => {
  if (error) throw error;
};

export function supabaseGoalStore(sb: SupabaseClient, uid: string): GoalStore {
  return {
    async load(collection) {
      const { data, error } = await sb.from("goals").select("year, target").eq("collection", collection);
      fail(error);
      return Object.fromEntries(((data ?? []) as { year: number; target: number }[]).map((r) => [r.year, r.target]));
    },
    async set(collection, year, target) {
      const row = { user_id: uid, collection, year, target, updated_at: new Date().toISOString() };
      fail((await sb.from("goals").upsert(row, { onConflict: "user_id,collection,year" })).error);
    },
    async remove(collection, year) {
      fail((await sb.from("goals").delete().eq("user_id", uid).eq("collection", collection).eq("year", year)).error);
    },
  };
}

/** In-memory store for tests and the dev preview. */
export function memoryGoalStore(initial: Partial<Record<CollectionKey, Goals>> = {}): GoalStore & { rows: Partial<Record<CollectionKey, Goals>> } {
  const rows = structuredClone(initial);
  return {
    rows,
    load: async (c) => ({ ...rows[c] }),
    set: async (c, year, target) => void ((rows[c] ??= {})[year] = target),
    remove: async (c, year) => void delete rows[c]?.[year],
  };
}

// ---------------------------------------------------------------- progress

export interface GoalProgress {
  year: number;
  target: number | null;
  /** Done in `year`, by their date. */
  done: Item[];
  count: number;
  /** Under way now (only counted for the current year). */
  inProgress: number;
  /** Sum of `extra.field` over `done`. */
  extra: number;
  /** Done per month, January first. */
  months: number[];
  /** The current year only: how far through it today is (0–1). */
  elapsed: number | null;
  /** The current year with a target: count − where an even pace would be by today. */
  ahead: number | null;
  /** The current year with a target still open: how many a month it takes from here. */
  perMonth: number | null;
  /** Done, but with no date, so no year to count them in. */
  undated: Item[];
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** How far through its year `d` is, counting today as done. */
export function yearElapsed(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 864e5) + 1;
  return day / (isLeap(d.getFullYear()) ? 366 : 365);
}

export function goalProgress(goal: GoalConfig, items: Item[], year: number, target: number | null, today = new Date()): GoalProgress {
  const matching = items.filter((g) => condMatch(goal.match, g));
  const done = matching.filter((g) => ymd(g[goal.dateField]).slice(0, 4) === String(year));
  const months = Array<number>(12).fill(0);
  done.forEach((g) => {
    const m = Number(ymd(g[goal.dateField]).slice(5, 7));
    if (m >= 1 && m <= 12) months[m - 1]++;
  });
  const extra = goal.extra ? done.reduce((s, g) => s + (Number(g[goal.extra!.field]) || 0), 0) : 0;
  const current = year === today.getFullYear();
  const elapsed = current ? yearElapsed(today) : null;
  const count = done.length;
  // Behind only once a whole one is due: 17 done when 17.8 are due is on track.
  const ahead = elapsed != null && target ? count - Math.floor(target * elapsed) : null;
  const monthsLeft = 12 - today.getMonth();
  const perMonth = current && target && count < target ? (target - count) / monthsLeft : null;
  return {
    year,
    target,
    done,
    count,
    inProgress: current && goal.inProgress ? items.filter((g) => condMatch(goal.inProgress, g)).length : 0,
    extra,
    months,
    elapsed,
    ahead,
    perMonth,
    undated: matching.filter((g) => !ymd(g[goal.dateField])),
  };
}

/** Past years that had a goal, newest first, with how they ended. */
export function goalHistory(goal: GoalConfig, items: Item[], goals: Goals, today = new Date()) {
  return Object.keys(goals)
    .map(Number)
    .filter((y) => y < today.getFullYear())
    .sort((a, b) => b - a)
    .map((year) => {
      const p = goalProgress(goal, items, year, goals[year], today);
      return { year, target: goals[year], count: p.count, met: p.count >= goals[year] };
    });
}
