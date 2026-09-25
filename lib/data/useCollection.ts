"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { CollectionKey, Item } from "@/lib/collection/types";
import { withBase } from "@/lib/paths";
import { collectionActions } from "./collection-actions";
import { collectionReducer, initialCollectionState, type CollectionAction, type CollectionState } from "./collection-state";
import type { CollectionStore } from "./store";
import { downloadJson, exportFileName, toExportJson } from "./transfer";

type Tagged = CollectionAction | { type: "reset" };

function reducer(s: CollectionState, a: Tagged): CollectionState {
  return a.type === "reset" ? initialCollectionState : collectionReducer(s, a);
}

/**
 * Loads one collection from `store` and exposes its state plus actions. Passing
 * a new store (another collection or user) resets and reloads; late results
 * from a previous store are ignored.
 */
export function useCollection(key: CollectionKey, store: CollectionStore | null) {
  const [state, rawDispatch] = useReducer(reducer, initialCollectionState);
  const stateRef = useRef(state);
  const storeRef = useRef(store);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Declared before the load effect so it is current when that effect runs.
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const actions = useMemo(() => {
    if (!store) return null;
    // Compare against the live store rather than a disposed flag: StrictMode
    // runs effects twice, and a flag would silence the second (real) load.
    const dispatch = (a: CollectionAction) => {
      if (storeRef.current === store) rawDispatch(a);
    };
    return collectionActions(store, dispatch, () => stateRef.current, {
      backup: (items: Item[]) => downloadJson(exportFileName(key), toExportJson(items)),
      loadSeed: async () => {
        const res = await fetch(withBase(`/seeds/${key}.json`));
        if (!res.ok) throw new Error("Could not load the starter data.");
        return res.json();
      },
    });
  }, [key, store]);

  useEffect(() => {
    if (!actions) return;
    rawDispatch({ type: "reset" });
    actions.refresh();
  }, [actions]);

  useEffect(() => {
    if (!store?.subscribe) return;
    return store.subscribe((change) => rawDispatch({ type: "remote", change }));
  }, [store]);

  return { state, actions };
}
