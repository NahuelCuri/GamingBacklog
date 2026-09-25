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
 * a new store (another collection or user) resets and reloads; results from a
 * previous store are ignored.
 */
export function useCollection(key: CollectionKey, store: CollectionStore | null) {
  const [state, rawDispatch] = useReducer(reducer, initialCollectionState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const actions = useMemo(() => {
    if (!store) return null;
    let alive = true;
    const dispatch = (a: CollectionAction) => {
      if (alive) rawDispatch(a);
    };
    const act = collectionActions(store, dispatch, () => stateRef.current, {
      backup: (items: Item[]) => downloadJson(exportFileName(key), toExportJson(items)),
      loadSeed: async () => {
        const res = await fetch(withBase(`/seeds/${key}.json`));
        if (!res.ok) throw new Error("Could not load the starter data.");
        return res.json();
      },
    });
    return {
      ...act,
      dispose: () => {
        alive = false;
      },
    };
  }, [key, store]);

  useEffect(() => {
    if (!actions) return;
    rawDispatch({ type: "reset" });
    actions.refresh();
    return actions.dispose;
  }, [actions]);

  useEffect(() => {
    if (!store?.subscribe) return;
    return store.subscribe((change) => rawDispatch({ type: "remote", change }));
  }, [store]);

  return { state, actions };
}
