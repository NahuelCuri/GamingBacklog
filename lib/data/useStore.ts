"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import type { CollectionKey } from "@/lib/collection/types";
import { getSupabase } from "@/lib/supabase";
import { supabaseStore, type CollectionStore } from "./store";

/** The signed-in user's store for a collection, or null while signed out. */
export function useStore(key: CollectionKey): CollectionStore | null {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useMemo(() => {
    const sb = getSupabase();
    return sb && uid ? supabaseStore(sb, key, uid) : null;
  }, [key, uid]);
}
