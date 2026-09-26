"use client";

// Trip Planner data: loads both tables, applies edits optimistically, writes
// only what changed, and follows the other member's edits live.
// Differences from legacy: a failed load shows an error with Retry (legacy fell
// back to the example trip, and the next edit could push it over real data),
// and a failed write is reported and the server state reloaded (legacy only
// logged it to the console).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { errorMessage, getSupabase } from "@/lib/supabase";
import { isTripMember } from "@/config/libraries";
import { byOrder, seedTrips, withOrder, type TripData } from "./model";
import { diffRows, saveLocalCopy, supabaseTripStore, type TripChange, type TripStore } from "./store";

export interface TripsState extends TripData {
  status: "loading" | "ready" | "error";
  loadError: string | null;
  syncError: string | null;
}

const INITIAL: TripsState = { status: "loading", trips: [], cards: [], loadError: null, syncError: null };

export function applyChange(s: TripsState, c: TripChange): TripsState {
  if (s.status !== "ready") return s;
  if (c.type === "delete") {
    return c.kind === "trips" ? { ...s, trips: s.trips.filter((x) => x.id !== c.id) } : { ...s, cards: s.cards.filter((x) => x.id !== c.id) };
  }
  const put = <T extends { id: string }>(list: T[], row: T) => {
    const i = list.findIndex((x) => x.id === row.id);
    return i >= 0 ? list.map((x, j) => (j === i ? row : x)) : [...list, row];
  };
  return c.kind === "trips" ? { ...s, trips: put(s.trips, c.row) } : { ...s, cards: byOrder(put(s.cards, c.row)) };
}

/** The shared trip store for a signed-in trip member, else null. */
export function useTripStore(): TripStore | null {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useMemo(() => {
    const sb = getSupabase();
    return sb && uid && isTripMember(uid) ? supabaseTripStore(sb, uid) : null;
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
      await Promise.all([store.upsert("trips", t.changed), store.upsert("cards", c.changed)]);
      await Promise.all([store.remove("cards", c.removed), store.remove("trips", t.removed)]);
    },
    [store],
  );

  const load = useCallback(async () => {
    if (!store) return;
    const mine = () => storeRef.current === store;
    try {
      let data = await store.load();
      if (!mine()) return;
      if (!data.trips.length && !data.cards.length) {
        // First run on an empty shared space: add the example trip. Its ids are
        // fixed, so two members loading at once just overwrite the same rows.
        data = seedTrips();
        await write({ trips: [], cards: [] }, data);
      }
      if (mine()) setState((s) => ({ ...s, trips: data.trips, cards: byOrder(data.cards), status: "ready", loadError: null }));
    } catch (e) {
      if (!mine()) return;
      setState((s) => (s.status === "ready" ? { ...s, syncError: errorMessage(e) } : { ...INITIAL, status: "error", loadError: errorMessage(e) }));
    }
  }, [store, write]);

  useEffect(() => {
    storeRef.current = store;
    setState(INITIAL);
    void load();
  }, [store, load]);

  useEffect(() => {
    if (!store?.subscribe) return;
    return store.subscribe((c) => setState((s) => applyChange(s, c)));
  }, [store]);

  /** Apply an edit to trips and/or cards, then write the difference. */
  const persist = useCallback(
    async (patch: Partial<TripData>) => {
      const cur = stateRef.current;
      if (cur.status !== "ready") return;
      const prev = { trips: cur.trips, cards: cur.cards };
      const next = { trips: patch.trips ?? cur.trips, cards: patch.cards ? withOrder(patch.cards) : cur.cards };
      stateRef.current = { ...cur, ...next };
      setState((s) => ({ ...s, ...next }));
      saveLocalCopy(next);
      try {
        await write(prev, next);
      } catch (e) {
        setState((s) => ({ ...s, syncError: errorMessage(e) }));
        void load();
      }
    },
    [write, load],
  );

  const dismissSyncError = useCallback(() => setState((s) => ({ ...s, syncError: null })), []);
  const retry = useCallback(() => {
    setState(INITIAL);
    void load();
  }, [load]);

  return { state, persist, retry, dismissSyncError };
}
