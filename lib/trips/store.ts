// Trip Planner storage. Trips and cards live in the `trips` and `trip_cards`
// tables (PK id, row { id, data, added_by, updated_at }). Each trip has an owner
// and may be shared with other accounts (`trip_shares`); RLS returns only the
// trips the user owns or was invited to (supabase/trips_sharing.sql). A
// realtime channel follows edits by the others in a trip.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trip, TripCard, TripData } from "./model";

export type TripKind = "trips" | "cards";
const TABLE: Record<TripKind, string> = { trips: "trips", cards: "trip_cards" };

/** Someone with access to a trip: its owner or a guest. */
export interface TripPerson {
  trip: string;
  user: string;
  email: string;
  role: "owner" | "editor" | "viewer";
}

export type ShareResult = "ok" | "not_found" | "self" | "not_owner";

export type TripChange =
  | { kind: "trips"; type: "upsert"; row: Trip }
  | { kind: "cards"; type: "upsert"; row: TripCard }
  | { kind: TripKind; type: "delete"; id: string }
  /** Someone was invited or removed: reload to pick up (or drop) whole trips. */
  | { kind: "shares"; type: "reload" };

export interface TripStore {
  /** The signed-in account, when there is one (names the local copy). */
  uid?: string;
  load(): Promise<TripData & { people: TripPerson[] }>;
  upsert(kind: TripKind, rows: (Trip | TripCard)[]): Promise<void>;
  remove(kind: TripKind, ids: string[]): Promise<void>;
  /** Invite an account, by exact email, to a trip the user owns. */
  share(tripId: string, email: string): Promise<ShareResult>;
  /** Remove a guest (the owner), or leave a trip (the guest themself). */
  unshare(tripId: string, userId: string): Promise<void>;
  /** Live changes from the others; returns an unsubscribe function. */
  subscribe?(onChange: (c: TripChange) => void): () => void;
}

const fail = (error: unknown) => {
  if (error) throw error;
};

export function supabaseTripStore(sb: SupabaseClient, uid: string): TripStore {
  return {
    uid,
    async load() {
      const [tr, cr, pr] = await Promise.all([sb.from(TABLE.trips).select("data"), sb.from(TABLE.cards).select("data"), sb.rpc("trip_people")]);
      fail(tr.error);
      fail(cr.error);
      fail(pr.error);
      const rows = <T>(r: { data: unknown }) => ((r.data as { data: T | null }[] | null) || []).map((x) => x.data).filter(Boolean) as T[];
      const people = ((pr.data as { trip_id: string; user_id: string; email: string; role: TripPerson["role"] }[] | null) || []).map((p) => ({
        trip: p.trip_id, user: p.user_id, email: p.email, role: p.role,
      }));
      return { trips: rows<Trip>(tr), cards: rows<TripCard>(cr), people };
    },
    async upsert(kind, list) {
      if (!list.length) return;
      const now = new Date().toISOString();
      // No owner_id: a new trip gets the writer as owner (column default), an existing one keeps its owner.
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
    async share(tripId, email) {
      const { data, error } = await sb.rpc("share_trip", { p_trip: tripId, p_email: email });
      fail(error);
      return data as ShareResult;
    },
    async unshare(tripId, userId) {
      const { error } = await sb.from("trip_shares").delete().eq("trip_id", tripId).eq("user_id", userId);
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
        .channel("trips-" + uid)
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE.trips }, handler("trips"))
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE.cards }, handler("cards"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_shares" }, () => onChange({ kind: "shares", type: "reload" }))
        .subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}

/**
 * In-memory store for tests and the dev preview. `users` maps the emails that
 * can be invited to their account ids; `people` starts out empty, which the
 * planner reads as "every trip is yours".
 */
export function memoryTripStore(
  initial: Partial<TripData> = {},
  { users = {}, people = [] }: { users?: Record<string, string>; people?: TripPerson[] } = {},
): TripStore & { data: TripData; people: TripPerson[] } {
  const data: TripData = { trips: [...(initial.trips || [])], cards: [...(initial.cards || [])] };
  const put = <T extends { id: string }>(list: T[], rows: T[]) =>
    rows.forEach((r) => {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r;
      else list.push(r);
    });
  const store = {
    data,
    people: [...people],
    async load() {
      return { ...structuredClone(data), people: structuredClone(store.people) };
    },
    async upsert(kind: TripKind, rows: (Trip | TripCard)[]) {
      put(data[kind] as { id: string }[], structuredClone(rows) as { id: string }[]);
    },
    async remove(kind: TripKind, ids: string[]) {
      (data as unknown as Record<TripKind, { id: string }[]>)[kind] = data[kind].filter((x) => !ids.includes(x.id));
    },
    async share(tripId: string, email: string): Promise<ShareResult> {
      const user = users[email.trim().toLowerCase()];
      if (!user) return "not_found";
      if (!store.people.some((p) => p.trip === tripId && p.user === user)) store.people.push({ trip: tripId, user, email: email.trim().toLowerCase(), role: "editor" });
      return "ok";
    },
    async unshare(tripId: string, userId: string) {
      store.people = store.people.filter((p) => !(p.trip === tripId && p.user === userId));
    },
  };
  return store;
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

/** Every change is also kept here, per account, as a local backup copy. */
export const LOCAL_KEY = "trip-planner-v1";
export const localKey = (uid?: string) => (uid ? LOCAL_KEY + ":" + uid : LOCAL_KEY);

export function saveLocalCopy(d: TripData, uid?: string) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify({ trips: d.trips, cards: d.cards }));
  } catch {
    /* quota or private mode: the cloud copy is the source of truth */
  }
}
