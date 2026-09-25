// Collection operations, independent of React so they can be unit-tested.
// Writes are optimistic (the UI updates at once, like legacy) but, unlike
// legacy, a failed write is surfaced and the data is re-read from the server.
import type { Dispatch } from "react";
import type { Item } from "@/lib/collection/types";
import { errorMessage } from "@/lib/supabase";
import { canTransfer, type CollectionAction, type CollectionState } from "./collection-state";
import type { CollectionStore } from "./store";

export interface ActionDeps {
  /** Saves a JSON backup of the current items (a file download in the browser). */
  backup(items: Item[]): void;
  /** Fetches the collection's starter seed. */
  loadSeed(): Promise<Item[]>;
}

export function collectionActions(
  store: CollectionStore,
  dispatch: Dispatch<CollectionAction>,
  getState: () => CollectionState,
  deps: ActionDeps,
) {
  const refresh = async () => {
    dispatch({ type: "load" });
    try {
      dispatch({ type: "loaded", items: await store.load() });
    } catch (e) {
      dispatch({ type: "loadFailed", error: errorMessage(e, "Could not load your data.") });
    }
  };

  const write = async (op: () => Promise<void>) => {
    try {
      await op();
    } catch (e) {
      dispatch({ type: "syncFailed", error: errorMessage(e, "Could not save your changes.") });
      await refresh();
    }
  };

  const requireLoaded = () => {
    const s = getState();
    if (!canTransfer(s)) throw new Error("Data is not loaded yet.");
    return s;
  };

  return {
    refresh,

    dismissSyncError: () => dispatch({ type: "dismissSyncError" }),

    save(item: Item) {
      dispatch({ type: "upsert", item });
      return write(() => store.putOne(item));
    },

    remove(id: string) {
      dispatch({ type: "remove", id });
      return write(() => store.delOne(id));
    },

    /** Legacy "Load starter": replaces the view with the seed and saves it. */
    async loadStarter() {
      const seed = (await deps.loadSeed()).map((g) => ({ ...g }));
      dispatch({ type: "replace", items: seed });
      return write(() => store.putAll(seed));
    },

    /** Download the current items. Throws while the data is not loaded. */
    exportNow() {
      deps.backup(requireLoaded().items);
    },

    /**
     * Replace the whole collection with `items`. Always downloads a backup of
     * the current data first. New rows are written before stale ones are
     * deleted, so a failure midway never leaves the table empty.
     */
    async importReplace(items: Item[]) {
      const before = requireLoaded().items;
      deps.backup(before);
      dispatch({ type: "replace", items });
      const keep = new Set(items.map((g) => g.id));
      return write(async () => {
        await store.putAll(items);
        await store.delMany(before.map((g) => g.id).filter((id) => !keep.has(id)));
      });
    },
  };
}

export type CollectionActions = ReturnType<typeof collectionActions>;
