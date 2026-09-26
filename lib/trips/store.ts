// Trip Planner storage. Trips and cards live in the shared `trips` and
// `trip_cards` tables (PK id, row { id, data, added_by, updated_at }), scoped
// by RLS to the trip members, with a realtime channel so both see edits live.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trip, TripCard, TripData } from "./model";

export type TripKind = "trips" | "cards";
const TABLE: Record<TripKind, string> = { trips: "trips", cards: "trip_cards" };

export type TripChange =
  | { kind: "trips"; type: "upsert"; row: Trip }
  | { kind: "cards"; type: "upsert"; row: TripCard }
  | { kind: TripKind; type: "delete"; id: string };

export interface TripStore {
  load(): Promise<TripData>;
  upsert(kind: TripKind, rows: (Trip | TripCard)[]): Promise<void>;
  remove(kind: TripKind, ids: string[]): Promise<void>;
  /** Live changes from the other member; returns an unsubscribe function. */
  subscribe?(onChange: (c: TripChange) => void): () => void;
}

const fail = (error: unknown) => {
  if (error) throw error;
};

export function supabaseTripStore(sb: SupabaseClient, uid: string): TripStore {
  return {
    async load() {
      const [tr, cr] = await Promise.all([sb.from(TABLE.trips).select("data"), sb.from(TABLE.cards).select("data")]);
      fail(tr.error);
      fail(cr.error);
      const rows = <T>(r: { data: unknown }) => ((r.data as { data: T | null }[] | null) || []).map((x) => x.data).filter(Boolean) as T[];
      return { trips: rows<Trip>(tr), cards: rows<TripCard>(cr) };
    },
    async upsert(kind, list) {
      if (!list.length) return;
      const now = new Date().toISOString();
      const { error } = await sb
        .from(TABLE[kind])
        .upsert(list.map((x) => ({ id: x.id, data: x, added_by: uid, updated_at: now })), { onConflict: "id" });
      fail(error);
    },
    async remove(kind, ids) {
      if (!ids.length) return;
      const { error } = await sb.from(TABLE[kind]).delete().in("id", ids);
      fail(error);
    },
    subscribe(onChange) {
      const handler = (kind: TripKind) => (p: { eventType: string; new?: unknown; old?: unknown }) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string } | null)?.id;
          if (id) onChange({ kind, type: "delete", id });
          return;
        }
        const row = (p.new as { data?: Trip & TripCard } | null)?.data;
        if (row) onChange({ kind, type: "upsert", row } as TripChange);
      };
      const channel = sb
        .channel("trips-shared")
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE.trips }, handler("trips"))
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE.cards }, handler("cards"))
        .subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}

/** In-memory store for tests and the dev preview. */
export function memoryTripStore(initial: Partial<TripData> = {}): TripStore & { data: TripData } {
  const data: TripData = { trips: [...(initial.trips || [])], cards: [...(initial.cards || [])] };
  const put = <T extends { id: string }>(list: T[], rows: T[]) =>
    rows.forEach((r) => {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r;
      else list.push(r);
    });
  return {
    data,
    async load() {
      return structuredClone(data);
    },
    async upsert(kind, rows) {
      put(data[kind] as { id: string }[], structuredClone(rows));
    },
    async remove(kind, ids) {
      (data as unknown as Record<TripKind, { id: string }[]>)[kind] = data[kind].filter((x) => !ids.includes(x.id));
    },
  };
}

/** What to write so the table goes from `prev` to `next` (legacy _syncTable). */
export function diffRows<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, JSON.stringify(x)]));
  const ids = new Set(next.map((x) => x.id));
  return {
    changed: next.filter((x) => before.get(x.id) !== JSON.stringify(x)),
    removed: prev.filter((x) => !ids.has(x.id)).map((x) => x.id),
  };
}

/** Legacy writes every change here too; kept as a local backup copy (same key and shape). */
export const LOCAL_KEY = "trip-planner-v1";

export function saveLocalCopy(d: TripData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ trips: d.trips, cards: d.cards }));
  } catch {
    /* quota or private mode: the cloud copy is the source of truth */
  }
}
