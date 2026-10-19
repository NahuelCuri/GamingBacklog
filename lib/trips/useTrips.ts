"use client";

// Trip Planner data: loads the user's own and shared trips with who is in each,
// applies edits optimistically, writes only what changed, and follows the
// others' edits live.
// Differences from legacy: a failed load shows an error with Retry (legacy fell
// back to the example trip, and the next edit could push it over real data),
// and a failed write is reported and the server state reloaded (legacy only
// logged it to the console).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { errorMessage, getSupabase } from "@/lib/supabase";
import { byOrder, seedTrips, withFreshIds, withOrder, type TripData } from "./model";
import { diffRows, saveLocalCopy, supabaseTripStore, type TripChange, type TripPerson, type TripStore } from "./store";

export interface TripsState extends TripData {
  /** Owner and guests of each trip; a trip with nobody listed is the user's own. */
  people: TripPerson[];
  status: "loading" | "ready" | "error";
  loadError: string | null;
  syncError: string | null;
}

/**
 * The example trip being written for a store, so two loads at once (StrictMode,
 * two hooks on one store) add it once: its ids are new each time.
 */
const seeding = new WeakMap<TripStore, Promise<TripData>>();

const INITIAL: TripsState = { status: "loading", trips: [], cards: [], people: [], loadError: null, syncError: null };

export function applyChange(s: TripsState, c: TripChange): TripsState {
  if (s.status !== "ready" || c.kind === "shares") return s;
  if (c.type === "delete") {
    return c.kind === "trips" ? { ...s, trips: s.trips.filter((x) => x.id !== c.id) } : { ...s, cards: s.cards.filter((x) => x.id !== c.id) };
  }
  const put = <T extends { id: string }>(list: T[], row: T) => {
    const i = list.findIndex((x) => x.id === row.id);
    return i >= 0 ? list.map((x, j) => (j === i ? row : x)) : [...list, row];
  };
  return c.kind === "trips" ? { ...s, trips: put(s.trips, c.row) } : { ...s, cards: byOrder(put(s.cards, c.row)) };
}

/** The trip store for the signed-in user, else null. */
export function useTripStore(): TripStore | null {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useMemo(() => {
    const sb = getSupabase();
    return sb && uid ? supabaseTripStore(sb, uid) : null;
  }, [uid]);
}

export function useTrips(store: TripStore | null) {
  const [state, setState] = useState<TripsState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  const storeRef = useRef(store);

  const write = useCallback(
    async (prev: TripData, next: TripData) => {
      if (!store) return;
      const t = diffRows(prev.trips, next.trips), c = diffRows(prev.cards, next.cards);
      // One table at a time: RLS checks a card against its trip, so a new trip
      // goes in before its cards, and a deleted trip's cards go before it.
      await store.upsert("trips", t.changed);
      await store.upsert("cards", c.changed);
      await store.remove("cards", c.removed);
      await store.remove("trips", t.removed);
    },
    [store],
  );

  /** `seed`: on the first load, an account with no trips gets the example one. */
  const load = useCallback(async (seed = false) => {
    if (!store) return;
    const mine = () => storeRef.current === store;
    try {
      const got = await store.load();
      if (!mine()) return;
      let data: TripData = got;
      if (seed && !data.trips.length && !data.cards.length) {
        let p = seeding.get(store);
        if (!p) {
          const fresh = withFreshIds(seedTrips());
          p = write({ trips: [], cards: [] }, fresh).then(() => fresh);
          seeding.set(store, p);
          p.catch(() => seeding.delete(store));
        }
        data = await p;
      }
      if (mine()) setState((s) => ({ ...s, trips: data.trips, cards: byOrder(data.cards), people: got.people, status: "ready", loadError: null }));
    } catch (e) {
      if (!mine()) return;
      setState((s) => (s.status === "ready" ? { ...s, syncError: errorMessage(e) } : { ...INITIAL, status: "error", loadError: errorMessage(e) }));
    }
  }, [store, write]);

  useEffect(() => {
    storeRef.current = store;
    setState(INITIAL);
    void load(true);
  }, [store, load]);

  useEffect(() => {
    if (!store?.subscribe) return;
    return store.subscribe((c) => (c.kind === "shares" ? void load() : setState((s) => applyChange(s, c))));
  }, [store, load]);

  /** Apply an edit to trips and/or cards, then write the difference. */
  const persist = useCallback(
    async (patch: Partial<TripData>) => {
      const cur = stateRef.current;
      if (cur.status !== "ready") return;
      const prev = { trips: cur.trips, cards: cur.cards };
      const next = { trips: patch.trips ?? cur.trips, cards: patch.cards ? withOrder(patch.cards) : cur.cards };
      stateRef.current = { ...cur, ...next };
      setState((s) => ({ ...s, ...next }));
      saveLocalCopy(next, store?.uid);
      try {
        await write(prev, next);
      } catch (e) {
        setState((s) => ({ ...s, syncError: errorMessage(e) }));
        void load();
      }
    },
    [write, load, store],
  );

  /** Re-reads everything (after inviting, removing or leaving). */
  const reload = useCallback(() => load(), [load]);

  const dismissSyncError = useCallback(() => setState((s) => ({ ...s, syncError: null })), []);
  const retry = useCallback(() => {
    setState(INITIAL);
    void load(true);
  }, [load]);

  return { state, persist, reload, retry, dismissSyncError };
}
