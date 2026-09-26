import { describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import type { Item } from "@/lib/collection/types";
import { collectionActions } from "./collection-actions";
import { canTransfer, collectionReducer, initialCollectionState, type CollectionAction, type CollectionState } from "./collection-state";
import { memoryStore, supabaseStore, type CollectionStore } from "./store";
import { exportFileName, parseImport } from "./transfer";

const a = (id: string, title = id): Item => ({ id, title });

// ---------------------------------------------------------------- reducer

describe("collectionReducer", () => {
  const ready = (items: Item[]): CollectionState => collectionReducer(initialCollectionState, { type: "loaded", items });

  it("starts loading and cannot export", () => {
    expect(initialCollectionState.status).toBe("loading");
    expect(canTransfer(initialCollectionState)).toBe(false);
  });

  it("a failed first load is an error, not an empty collection (the export [] bug)", () => {
    const s = collectionReducer(initialCollectionState, { type: "loadFailed", error: "network" });
    expect(s).toMatchObject({ status: "error", loadError: "network", items: [] });
    expect(canTransfer(s)).toBe(false);
  });

  it("a failed refresh keeps the loaded rows and reports a sync error", () => {
    let s = ready([a("1"), a("2")]);
    s = collectionReducer(s, { type: "load" });
    expect(s.status).toBe("ready");
    s = collectionReducer(s, { type: "loadFailed", error: "timeout" });
    expect(s).toMatchObject({ status: "ready", syncError: "timeout" });
    expect(s.items).toHaveLength(2);
    expect(canTransfer(s)).toBe(true);
  });

  it("upserts replace in place and append new rows", () => {
    let s = ready([a("1"), a("2")]);
    s = collectionReducer(s, { type: "upsert", item: a("1", "edited") });
    s = collectionReducer(s, { type: "upsert", item: a("3") });
    expect(s.items.map((x) => x.title)).toEqual(["edited", "2", "3"]);
  });

  it("applies remote changes only once loaded", () => {
    const change: CollectionAction = { type: "remote", change: { type: "upsert", item: a("9") } };
    expect(collectionReducer(initialCollectionState, change)).toBe(initialCollectionState);
    let s = collectionReducer(ready([a("1")]), change);
    s = collectionReducer(s, { type: "remote", change: { type: "delete", id: "1" } });
    expect(s.items.map((x) => x.id)).toEqual(["9"]);
  });
});

// ---------------------------------------------------------------- actions

function harness(store: CollectionStore, seed: Item[] = []) {
  let state = initialCollectionState;
  const dispatch = (x: CollectionAction) => (state = collectionReducer(state, x));
  const backup = vi.fn();
  const act = collectionActions(store, dispatch, () => state, { backup, loadSeed: async () => seed });
  return { act, backup, get state() { return state; } };
}

/** Records the order of store calls; optionally fails one method. */
function recordingStore(initial: Item[], failOn?: keyof CollectionStore) {
  const inner = memoryStore(initial);
  const calls: string[] = [];
  const wrap = <K extends keyof CollectionStore>(k: K) =>
    (async (...args: unknown[]) => {
      calls.push(k);
      if (k === failOn) throw { message: `${k} failed` };
      return (inner[k] as (...a: unknown[]) => unknown)(...args);
    }) as CollectionStore[K];
  const store: CollectionStore = {
    load: wrap("load"), putOne: wrap("putOne"), putAll: wrap("putAll"),
    delOne: wrap("delOne"), delMany: wrap("delMany"), clearAll: wrap("clearAll"),
  };
  return { store, calls, rows: inner.rows };
}

describe("collectionActions", () => {
  it("loads, saves and removes against the store", async () => {
    const { store, rows } = recordingStore([a("1")]);
    const h = harness(store);
    await h.act.refresh();
    expect(h.state.status).toBe("ready");
    await h.act.save(a("2"));
    await h.act.remove("1");
    expect(h.state.items.map((x) => x.id)).toEqual(["2"]);
    expect([...rows.keys()]).toEqual(["2"]);
  });

  it("a failed write is reported and the server state is reloaded", async () => {
    const { store } = recordingStore([a("1")], "putOne");
    const h = harness(store);
    await h.act.refresh();
    await h.act.save(a("2"));
    expect(h.state.syncError).toBe("putOne failed");
    expect(h.state.items.map((x) => x.id)).toEqual(["1"]);
  });

  it("refuses to export or import before the data is loaded", async () => {
    const { store } = recordingStore([a("1")], "load");
    const h = harness(store);
    await h.act.refresh();
    expect(h.state.status).toBe("error");
    expect(() => h.act.exportNow()).toThrow(/not loaded/);
    await expect(h.act.importReplace([a("x")])).rejects.toThrow(/not loaded/);
    expect(h.backup).not.toHaveBeenCalled();
  });

  it("export hands the loaded items to the backup", async () => {
    const h = harness(memoryStore([a("1"), a("2")]));
    await h.act.refresh();
    h.act.exportNow();
    expect(h.backup).toHaveBeenCalledWith([a("1"), a("2")]);
  });

  it("import backs up first, writes new rows before deleting stale ones", async () => {
    const { store, calls, rows } = recordingStore([a("1"), a("2")]);
    const h = harness(store);
    await h.act.refresh();
    await h.act.importReplace([a("2", "new"), a("3")]);
    expect(h.backup).toHaveBeenCalledWith([a("1"), a("2")]);
    expect(calls).toEqual(["load", "putAll", "delMany"]);
    expect([...rows.values()]).toEqual([a("2", "new"), a("3")]);
    expect(h.state.items).toEqual([a("2", "new"), a("3")]);
  });

  it("an import whose write fails leaves the old rows in place", async () => {
    const { store, rows } = recordingStore([a("1")], "putAll");
    const h = harness(store);
    await h.act.refresh();
    await h.act.importReplace([a("9")]);
    expect([...rows.keys()]).toEqual(["1"]);
    expect(h.state.items.map((x) => x.id)).toEqual(["1"]);
    expect(h.state.syncError).toBe("putAll failed");
  });

  it("loadStarter shows and saves copies of the seed", async () => {
    const seed = [a("s1"), a("s2")];
    const store = memoryStore();
    const h = harness(store, seed);
    await h.act.refresh();
    await h.act.loadStarter();
    expect(h.state.items).toEqual(seed);
    expect(h.state.items[0]).not.toBe(seed[0]);
    expect(store.rows.size).toBe(2);
  });
});

// ---------------------------------------------------------------- supabase store

/** Chainable fake of the supabase query builder that records every call. */
function fakeSupabase(result: { data?: unknown; error?: unknown } = {}) {
  const log: unknown[][] = [];
  const builder = (): unknown =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return (res: (v: unknown) => void) => res({ data: result.data ?? [], error: result.error ?? null });
          return (...args: unknown[]) => {
            log.push([prop, ...args]);
            return builder();
          };
        },
      },
    );
  return { sb: builder() as never, log };
}

describe("supabaseStore", () => {
  it("per-user tables scope writes and deletes to the user", async () => {
    const { sb, log } = fakeSupabase();
    const s = supabaseStore(sb, "games", "u1");
    await s.putOne(a("1"));
    await s.delMany(["1", "2"]);
    await s.clearAll();
    expect(log).toEqual([
      ["from", "games"], ["upsert", { user_id: "u1", id: "1", data: a("1") }, { onConflict: "user_id,id" }],
      ["from", "games"], ["delete"], ["eq", "user_id", "u1"], ["in", "id", ["1", "2"]],
      ["from", "games"], ["delete"], ["eq", "user_id", "u1"],
    ]);
    expect(s.subscribe).toBeUndefined();
  });

  it("wines is shared: keyed by id with an added_by audit column", async () => {
    const { sb, log } = fakeSupabase();
    const s = supabaseStore(sb, "wines", "u1");
    await s.putOne(a("w1"));
    const [, [, row, opts]] = log;
    expect(row).toMatchObject({ id: "w1", data: a("w1"), added_by: "u1" });
    expect(opts).toEqual({ onConflict: "id" });
    expect(typeof s.subscribe).toBe("function");
  });

  it("load unwraps data rows and throws on error", async () => {
    const ok = supabaseStore(fakeSupabase({ data: [{ data: a("1") }, { data: null }] }).sb, "books", "u1");
    expect(await ok.load()).toEqual([a("1")]);
    const bad = supabaseStore(fakeSupabase({ error: { message: "permission denied" } }).sb, "books", "u1");
    await expect(bad.load()).rejects.toMatchObject({ message: "permission denied" });
  });

  it("wines realtime: maps inserts, updates and deletes, and unsubscribes", () => {
    let handler: ((p: unknown) => void) | null = null;
    const removed: unknown[] = [];
    const channel = {
      on: (_evt: string, filter: unknown, cb: (p: unknown) => void) => {
        expect(filter).toEqual({ event: "*", schema: "public", table: "wines" });
        handler = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    const sb = { channel: (name: string) => (expect(name).toBe("wines-shared"), channel), removeChannel: (c: unknown) => removed.push(c) };
    const changes: unknown[] = [];
    const unsubscribe = supabaseStore(sb as never, "wines", "u1").subscribe!((c) => changes.push(c));

    handler!({ eventType: "INSERT", new: { id: "w1", data: a("w1") } });
    handler!({ eventType: "UPDATE", new: { id: "w1", data: a("w1", "Malbec") } });
    handler!({ eventType: "DELETE", old: { id: "w1" } });
    handler!({ eventType: "UPDATE", new: { id: "w2" } }); // no data: ignored
    expect(changes).toEqual([
      { type: "upsert", item: a("w1") },
      { type: "upsert", item: a("w1", "Malbec") },
      { type: "delete", id: "w1" },
    ]);
    unsubscribe();
    expect(removed).toEqual([channel]);
  });

  it("empty bulk writes skip the network", async () => {
    const { sb, log } = fakeSupabase();
    const s = supabaseStore(sb, "games", "u1");
    await s.putAll([]);
    await s.delMany([]);
    expect(log).toEqual([]);
  });
});

// ---------------------------------------------------------------- transfer

describe("parseImport", () => {
  const cfg = COLLECTIONS.games;

  it("accepts a list of objects with unique ids", () => {
    expect(parseImport(JSON.stringify([a("1"), { id: "2" }]), cfg)).toEqual({ ok: true, items: [a("1"), { id: "2" }] });
    expect(parseImport("[]", cfg)).toEqual({ ok: true, items: [] });
  });

  it.each([
    ["not json", "{", /not valid JSON/],
    ["not a list", "{}", /Expected a list of games/],
    ["non-object row", "[1]", /Row 1 is not an object/],
    ["missing id", '[{"title":"x"}]', /Row 1 has no id/],
    ["duplicate id", '[{"id":"a"},{"id":"a"}]', /Row 2 repeats id "a"/],
  ])("rejects %s", (_name, text, err) => {
    const r = parseImport(text, cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(err);
  });

  it("names exports by collection and date", () => {
    expect(exportFileName("games", new Date("2026-09-25T12:00:00Z"))).toBe("backlog-games-2026-09-25.json");
  });
});
