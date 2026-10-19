// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { byOrder, seedTrips, withOrder, type TripCard } from "./model";
import { diffRows, localKey, memoryTripStore, supabaseTripStore, type TripChange, type TripStore } from "./store";
import { useTrips } from "./useTrips";

afterEach(() => localStorage.clear());

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

const card = (id: string, extra: Partial<TripCard> = {}): TripCard => ({ id, trip: "t1", title: id, type: "place", status: "idea", ...extra });

describe("supabaseTripStore", () => {
  it("writes shared rows keyed by id with the author, and deletes by id", async () => {
    const { sb, log } = fakeSupabase();
    const s = supabaseTripStore(sb, "u1");
    await s.upsert("cards", [card("c1")]);
    await s.remove("trips", ["t1"]);
    await s.upsert("trips", []);
    expect(log[0]).toEqual(["from", "trip_cards"]);
    expect(log[1][0]).toBe("upsert");
    expect(log[1][1]).toEqual([expect.objectContaining({ id: "c1", data: card("c1"), added_by: "u1" })]);
    expect(log[1][2]).toEqual({ onConflict: "id" });
    expect(log.slice(2)).toEqual([["from", "trips"], ["delete"], ["in", "id", ["t1"]]]);
  });

  it("load unwraps both tables and throws on error", async () => {
    const ok = supabaseTripStore(fakeSupabase({ data: [{ data: card("c1") }, { data: null }] }).sb, "u1");
    expect(await ok.load()).toMatchObject({ trips: [card("c1")], cards: [card("c1")] });
    const bad = supabaseTripStore(fakeSupabase({ error: { message: "permission denied" } }).sb, "u1");
    await expect(bad.load()).rejects.toMatchObject({ message: "permission denied" });
  });

  it("loads who is in each trip", async () => {
    const people = [{ trip_id: "t1", user_id: "u1", email: "me@x", role: "owner" }];
    const { sb, log } = fakeSupabase({ data: people });
    expect((await supabaseTripStore(sb, "u1").load()).people).toEqual([{ trip: "t1", user: "u1", email: "me@x", role: "owner" }]);
    expect(log).toContainEqual(["rpc", "trip_people"]);
  });

  it("invites through the RPC and removes a share by trip and user", async () => {
    const { sb, log } = fakeSupabase({ data: "ok" as never });
    const s = supabaseTripStore(sb, "u1");
    expect(await s.share("t1", "bro@x")).toBe("ok");
    await s.unshare("t1", "u2");
    expect(log).toEqual([
      ["rpc", "share_trip", { p_trip: "t1", p_email: "bro@x" }],
      ["from", "trip_shares"], ["delete"], ["eq", "trip_id", "t1"], ["eq", "user_id", "u2"],
    ]);
  });

  it("maps realtime events from both tables on one channel", () => {
    const handlers: Record<string, (p: unknown) => void> = {};
    const removed: unknown[] = [];
    const channel = {
      on: (_e: string, f: { table: string }, cb: (p: unknown) => void) => ((handlers[f.table] = cb), channel),
      subscribe: () => channel,
    };
    const sb = { channel: (n: string) => (expect(n).toBe("trips-u1"), channel), removeChannel: (c: unknown) => removed.push(c) };
    const got: TripChange[] = [];
    const off = supabaseTripStore(sb as never, "u1").subscribe!((c) => got.push(c));
    handlers.trip_cards({ eventType: "UPDATE", new: { id: "c1", data: card("c1") } });
    handlers.trips({ eventType: "DELETE", old: { id: "t1" } });
    handlers.trips({ eventType: "INSERT", new: { id: "t2" } }); // no data: ignored
    handlers.trip_shares({ eventType: "INSERT", new: { trip_id: "t1" } });
    expect(got).toEqual([{ kind: "cards", type: "upsert", row: card("c1") }, { kind: "trips", type: "delete", id: "t1" }, { kind: "shares", type: "reload" }]);
    off();
    expect(removed).toEqual([channel]);
  });

  it("diffs only changed and removed rows", () => {
    expect(diffRows([card("a"), card("b"), card("c")], [card("a"), card("b", { title: "B" }), card("d")])).toEqual({
      changed: [card("b", { title: "B" }), card("d")],
      removed: ["c"],
    });
  });
});

describe("useTrips", () => {
  it("gives an account with no trips the example one, under ids of its own", async () => {
    const store = memoryTripStore();
    const { result } = renderHook(() => useTrips(store), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const seed = seedTrips();
    const [trip] = store.data.trips;
    expect(store.data.trips).toHaveLength(1); // StrictMode's second load doesn't add another
    expect(trip).toEqual({ ...seed.trips[0], id: expect.stringMatching(/^t\d+[0-9a-f]{6}$/) });
    expect(store.data.cards.map((c) => c.title)).toEqual(seed.cards.map((c) => c.title));
    const seedIds = new Set(seed.cards.map((c) => c.id));
    const ids = store.data.cards.map((c) => c.id);
    expect(store.data.cards.every((c) => c.trip === trip.id && /^c\d+[0-9a-f]{6}$/.test(c.id) && !seedIds.has(c.id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.current.state.trips).toEqual(store.data.trips);
  });

  it("writes a new trip before its cards and deletes cards before their trip", async () => {
    const inner = memoryTripStore(seedTrips());
    const calls: string[] = [];
    const store: TripStore = {
      ...inner,
      upsert: async (k, rows) => (rows.length && calls.push("upsert " + k), inner.upsert(k, rows)),
      remove: async (k, ids) => (ids.length && calls.push("remove " + k), inner.remove(k, ids)),
    };
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.persist({ trips: [...result.current.state.trips, { id: "t2", name: "Rome" }], cards: [...result.current.state.cards, card("n1", { trip: "t2" })] }));
    await act(() => result.current.persist({ trips: result.current.state.trips.filter((t) => t.id !== "t2"), cards: result.current.state.cards.filter((c) => c.trip !== "t2") }));
    expect(calls).toEqual(["upsert trips", "upsert cards", "remove cards", "remove trips"]);
  });

  it("reloads when someone is invited or removed", async () => {
    let push!: (c: TripChange) => void;
    const inner = memoryTripStore(seedTrips());
    const store: TripStore = { ...inner, subscribe: (cb) => ((push = cb), () => {}) };
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    inner.data.trips.push({ id: "t9", name: "Shared with me" });
    inner.people.push({ trip: "t9", user: "u9", email: "friend@x", role: "owner" });
    act(() => push({ kind: "shares", type: "reload" }));
    await waitFor(() => expect(result.current.state.trips.map((t) => t.id)).toEqual(["t1", "t9"]));
    expect(result.current.state.people).toEqual([{ trip: "t9", user: "u9", email: "friend@x", role: "owner" }]);
  });

  it("a failed load is an error with retry, not the example trip", async () => {
    let fail = true;
    const inner = memoryTripStore({ trips: [{ id: "real", name: "Real trip" }] });
    const store: TripStore = { ...inner, load: async () => (fail ? Promise.reject({ message: "offline" }) : inner.load()) };
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({ loadError: "offline", trips: [] });
    expect(inner.data.trips).toEqual([{ id: "real", name: "Real trip" }]);
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.trips).toEqual([{ id: "real", name: "Real trip" }]));
  });

  it("persists edits as row diffs and keeps a local copy", async () => {
    const store = memoryTripStore(seedTrips());
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const cards = result.current.state.cards.filter((c) => c.id !== "c12").map((c) => (c.id === "c1" ? { ...c, day: 2 } : c));
    await act(() => result.current.persist({ cards }));
    expect(store.data.cards).toEqual(withOrder(cards));
    expect(JSON.parse(localStorage.getItem(localKey())!).cards).toEqual(withOrder(cards));
  });

  it("saves card order so a reorder survives a reload (legacy lost it)", async () => {
    const store = memoryTripStore(seedTrips());
    const first = renderHook(() => useTrips(store));
    await waitFor(() => expect(first.result.current.state.status).toBe("ready"));
    const [a, b, ...rest] = first.result.current.state.cards;
    await act(() => first.result.current.persist({ cards: [b, a, ...rest] }));
    const written = store.data.cards.filter((c) => c.id === "c1" || c.id === "c2").map((c) => [c.id, c.order]);
    expect(written).toEqual([["c1", 1], ["c2", 0]]);
    expect(store.data.cards.filter((c) => c.order !== undefined)).toHaveLength(12);
    const again = renderHook(() => useTrips(store));
    await waitFor(() => expect(again.result.current.state.status).toBe("ready"));
    expect(again.result.current.state.cards.slice(0, 2).map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(byOrder([{ ...a, order: 1 }, { ...b }, { ...rest[0], order: 0 }]).map((c) => c.id)).toEqual([rest[0].id, a.id, b.id]);
  });

  it("a failed write is reported and the saved state reloaded", async () => {
    const inner = memoryTripStore(seedTrips());
    const store: TripStore = { ...inner, upsert: async () => Promise.reject({ message: "denied" }) };
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.persist({ cards: [...result.current.state.cards, card("new")] }));
    await waitFor(() => expect(result.current.state.cards.some((c) => c.id === "new")).toBe(false));
    expect(result.current.state.syncError).toBe("denied");
  });

  it("applies the other member's changes live", async () => {
    let push!: (c: TripChange) => void;
    const store: TripStore = { ...memoryTripStore(seedTrips()), subscribe: (cb) => ((push = cb), () => {}) };
    const { result } = renderHook(() => useTrips(store));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() => push({ kind: "cards", type: "upsert", row: card("c1", { title: "Renamed" }) }));
    act(() => push({ kind: "cards", type: "delete", id: "c2" }));
    act(() => push({ kind: "trips", type: "upsert", row: { id: "t2", name: "Rome" } }));
    const s = result.current.state;
    expect(s.cards.find((c) => c.id === "c1")?.title).toBe("Renamed");
    expect(s.cards.some((c) => c.id === "c2")).toBe(false);
    expect(s.trips.map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});
