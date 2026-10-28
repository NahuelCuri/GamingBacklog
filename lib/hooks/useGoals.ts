"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { CollectionKey } from "@/lib/collection/types";
import { supabaseGoalStore, type GoalStore, type Goals } from "@/lib/goals";
import { errorMessage, getSupabase } from "@/lib/supabase";

/** The signed-in user's goal store, or null while signed out. */
export function useGoalStore(): GoalStore | null {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useMemo(() => {
    const sb = getSupabase();
    return sb && uid ? supabaseGoalStore(sb, uid) : null;
  }, [uid]);
}

export interface GoalsApi {
  /** Null until loaded. */
  goals: Goals | null;
  error: string | null;
  /** `null` removes that year's goal. Applied at once; put back if saving fails. */
  setGoal(year: number, target: number | null): Promise<void>;
}

/** One library's goals. Off (null) when the library has none or there's no store. */
export function useGoals(collection: CollectionKey, store: GoalStore | null, enabled: boolean): GoalsApi | null {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store || !enabled) return;
    let live = true;
    setGoals(null);
    store.load(collection).then(
      (g) => live && setGoals(g),
      (e) => {
        if (!live) return;
        // A missing table (goals.sql not run yet) reads as "no goals", with the reason kept.
        setGoals({});
        setError(errorMessage(e));
      },
    );
    return () => {
      live = false;
    };
  }, [store, enabled, collection]);

  const setGoal = useCallback(
    async (year: number, target: number | null) => {
      if (!store) return;
      let before: Goals | null = null;
      setGoals((g) => {
        before = g;
        const next = { ...g };
        if (target == null) delete next[year];
        else next[year] = target;
        return next;
      });
      setError(null);
      try {
        await (target == null ? store.remove(collection, year) : store.set(collection, year, target));
      } catch (e) {
        setGoals(before);
        setError(errorMessage(e, "The goal was not saved."));
      }
    },
    [store, collection],
  );

  return useMemo(() => (store && enabled ? { goals, error, setGoal } : null), [store, enabled, goals, error, setGoal]);
}
