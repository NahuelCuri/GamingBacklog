// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { byOrder, seedTrips, withOrder, type TripCard } from "./model";
import { diffRows, LOCAL_KEY, memoryTripStore, supabaseTripStore, type TripChange, type TripStore } from "./store";
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
    expect(await ok.load()).toEqual({ trips: [card("c1")], cards: [card("c1")] });
    const bad = supabaseTripStore(fakeSupabase({ error: { message: "permission denied" } }).sb, "u1");
    await expect(bad.load()).rejects.toMatchObject({ message: "permission denied" });
  });

  it("maps realtime events from both tables on one channel", () => {
    const handlers: Record<string, (p: unknown) => void> = {};
    const removed: unknown[] = [];
    const channel = {
      on: (_e: string, f: { table: string }, cb: (p: unknown) => void) => ((handlers[f.table] = cb), channel),
      subscribe: () => channel,
    };
    const sb = { channel: (n: string) => (expect(n).toBe("trips-shared"), channel), removeChannel: (c: unknown) => removed.push(c) };
    const got: TripChange[] = [];
    const off = supabaseTripStore(sb as never, "u1").subscribe!((c) => got.push(c));
    handlers.trip_cards({ eventType: "UPDATE", new: { id: "c1", data: card("c1") } });
    handlers.trips({ eventType: "DELETE", old: { id: "t1" } });
    handlers.trips({ eventType: "INSERT", new: { id: "t2" } }); // no data: ignored
    expect(got).toEqual([{ kind: "cards", type: "upsert", row: card("c1") }, { kind: "trips", type: "delete", id: "t1" }]);
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
  it("adds the example trip to an empty shared space", async () => {
    const store = memoryTripStore();
    const { result } = renderHook(() => useTrips(store), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.state).toMatchObject(seedTrips());
    expect(store.data).toEqual(seedTrips());
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
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!).cards).toEqual(withOrder(cards));
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
