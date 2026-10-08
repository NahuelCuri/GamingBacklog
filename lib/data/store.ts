// Persistence for one collection. Mirrors the legacy GamesCollection sync:
// one table per collection key holding `{ id, data }` rows.
//  - per-user tables: PK (user_id, id), rows scoped by RLS to the owner
//  - `wines`: a shared cellar, PK id alone, `added_by` audit column, and a
//    realtime channel so both members stay in sync
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthKey } from "@/lib/collection/format";
import type { CollectionKey, Item } from "@/lib/collection/types";

export type RemoteChange = { type: "upsert"; item: Item } | { type: "delete"; id: string };

export interface CollectionStore {
  load(): Promise<Item[]>;
  /** Only the rows dated in `month` ("YYYY-MM"). */
  loadMonth?(month: string): Promise<Item[]>;
  putOne(item: Item): Promise<void>;
  putAll(items: Item[]): Promise<void>;
  delOne(id: string): Promise<void>;
  delMany(ids: string[]): Promise<void>;
  /** Deletes every row this user can see. For shared tables that is everyone's data. */
  clearAll(): Promise<void>;
  /** Live changes made by other clients; returns an unsubscribe function. */
  subscribe?(onChange: (c: RemoteChange) => void): () => void;
}

export const SHARED_COLLECTIONS: ReadonlySet<CollectionKey> = new Set(["wines"]);

export const isShared = (key: CollectionKey) => SHARED_COLLECTIONS.has(key);

/** Throws the Postgrest error, if any, so callers see a real failure. */
async function check(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

export function supabaseStore(sb: SupabaseClient, key: CollectionKey, uid: string): CollectionStore {
  const table = key;

  const unwrap = ({ data, error }: { data: unknown; error: unknown }) => {
    if (error) throw error;
    return ((data ?? []) as { data: Item | null }[]).map((r) => r.data).filter((x): x is Item => !!x);
  };
  const load = async () => unwrap(await sb.from(table).select("data"));
  // Dates are "YYYY-MM-DD" text inside the jsonb, so a string range picks the month.
  const loadMonth = async (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return unwrap(await sb.from(table).select("data").gte("data->>date", `${month}-01`).lt("data->>date", `${next}-01`));
  };

  if (isShared(key)) {
    const row = (g: Item) => ({ id: g.id, data: g, added_by: uid, updated_at: new Date().toISOString() });
    return {
      load,
      loadMonth,
      putOne: (g) => check(sb.from(table).upsert(row(g), { onConflict: "id" })),
      putAll: async (list) => {
        if (list.length) await check(sb.from(table).upsert(list.map(row), { onConflict: "id" }));
      },
      delOne: (id) => check(sb.from(table).delete().eq("id", id)),
      delMany: async (ids) => {
        if (ids.length) await check(sb.from(table).delete().in("id", ids));
      },
      clearAll: () => check(sb.from(table).delete().neq("id", "")),
      subscribe(onChange) {
        const channel = sb
          .channel(`${table}-shared`)
          .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string } | null)?.id;
              if (id) onChange({ type: "delete", id });
              return;
            }
            const item = (payload.new as { data?: Item } | null)?.data;
            if (item) onChange({ type: "upsert", item });
          })
          .subscribe();
        return () => {
          sb.removeChannel(channel);
        };
      },
    };
  }

  const row = (g: Item) => ({ user_id: uid, id: g.id, data: g });
  return {
    load,
    loadMonth,
    putOne: (g) => check(sb.from(table).upsert(row(g), { onConflict: "user_id,id" })),
    putAll: async (list) => {
      if (list.length) await check(sb.from(table).upsert(list.map(row), { onConflict: "user_id,id" }));
    },
    delOne: (id) => check(sb.from(table).delete().eq("user_id", uid).eq("id", id)),
    delMany: async (ids) => {
      if (ids.length) await check(sb.from(table).delete().eq("user_id", uid).in("id", ids));
    },
    clearAll: () => check(sb.from(table).delete().eq("user_id", uid)),
  };
}

/** In-memory store for tests and offline experiments. */
export function memoryStore(initial: Item[] = []): CollectionStore & { rows: Map<string, Item> } {
  const rows = new Map(initial.map((g) => [g.id, g]));
  return {
    rows,
    load: async () => [...rows.values()],
    loadMonth: async (month) => [...rows.values()].filter((g) => monthKey(g.date) === month),
    putOne: async (g) => void rows.set(g.id, g),
    putAll: async (list) => list.forEach((g) => rows.set(g.id, g)),
    delOne: async (id) => void rows.delete(id),
    delMany: async (ids) => ids.forEach((id) => rows.delete(id)),
    clearAll: async () => rows.clear(),
  };
}
