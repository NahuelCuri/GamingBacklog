// Collection state machine. The legacy app kept a bare `games` array and, on a
// failed cloud load, silently reset it to [] — which is how JSON export came
// out empty in prod. Here "no data yet" and "load failed" are explicit states,
// and a failed refresh never discards rows that were already loaded.
import type { Item } from "@/lib/collection/types";
import type { RemoteChange } from "./store";

export type LoadStatus = "loading" | "ready" | "error";

export interface CollectionState {
  status: LoadStatus;
  items: Item[];
  /** Why the initial load failed (status 'error'). */
  loadError: string | null;
  /** A write or refresh failed after the data was loaded. */
  syncError: string | null;
}

export type CollectionAction =
  | { type: "load" }
  | { type: "loaded"; items: Item[] }
  | { type: "loadFailed"; error: string }
  | { type: "upsert"; item: Item }
  | { type: "remove"; id: string }
  | { type: "replace"; items: Item[] }
  | { type: "remote"; change: RemoteChange }
  | { type: "syncFailed"; error: string }
  | { type: "dismissSyncError" };

export const initialCollectionState: CollectionState = { status: "loading", items: [], loadError: null, syncError: null };

function upsert(items: Item[], item: Item): Item[] {
  const i = items.findIndex((x) => x.id === item.id);
  if (i < 0) return [...items, item];
  const next = items.slice();
  next[i] = item;
  return next;
}

export function collectionReducer(s: CollectionState, a: CollectionAction): CollectionState {
  switch (a.type) {
    case "load":
      // A refresh of already-loaded data keeps showing (and exporting) it.
      return s.status === "ready" ? s : { ...s, status: "loading", loadError: null };
    case "loaded":
      // A reload after a failed write must not hide that failure; it stays until dismissed.
      return { status: "ready", items: a.items, loadError: null, syncError: s.syncError };
    case "loadFailed":
      return s.status === "ready" ? { ...s, syncError: a.error } : { ...s, status: "error", loadError: a.error };
    case "upsert":
      return { ...s, items: upsert(s.items, a.item) };
    case "remove":
      return { ...s, items: s.items.filter((x) => x.id !== a.id) };
    case "replace":
      return { ...s, items: a.items };
    case "remote": {
      if (s.status !== "ready") return s;
      const c = a.change;
      return c.type === "delete"
        ? { ...s, items: s.items.filter((x) => x.id !== c.id) }
        : { ...s, items: upsert(s.items, c.item) };
    }
    case "syncFailed":
      return { ...s, syncError: a.error };
    case "dismissSyncError":
      return { ...s, syncError: null };
  }
}

/** Export and import are only safe once the real data is in memory. */
export const canTransfer = (s: CollectionState) => s.status === "ready";
