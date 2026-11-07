import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMAS_FILE, schemasJson } from "@/scripts/mcp/schemas";
import { PRIOS, STATUSES, TYPES } from "@/lib/trips/model";
import { COLLECTIONS, dayIn, FIELD_HINTS, handleRpc, memoryRows, TRIP_CARD_PRIOS, TRIP_CARD_STATUSES, TRIP_CARD_TYPES, type Ctx, type Item } from "@/supabase/functions/_shared/backlog-tools";

const ctxWith = (initial: Record<string, Item[]> = {}) => {
  const rows = memoryRows(initial);
  // 02:30 UTC on Nov 1 is still Oct 31 in Buenos Aires.
  const ctx: Ctx = { rows, user: { id: "u1", email: "me@example.com" }, tz: "America/Argentina/Buenos_Aires", now: () => new Date("2026-11-01T02:30:00Z") };
  return { rows, ctx };
};

async function call(ctx: Ctx, name: string, args: Record<string, unknown>) {
  const r = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx);
  const res = r!.result as { isError?: boolean; content: { text: string }[] };
  return { isError: !!res.isError, text: res.content[0].text, json: () => JSON.parse(res.content[0].text) };
}

describe("MCP collection schemas", () => {
  it("collections.json matches config/collections (run `npm run mcp:schemas`)", () => {
    expect(readFileSync(SCHEMAS_FILE, "utf8").replace(/\r\n/g, "\n")).toBe(schemasJson());
  });
});

describe("MCP field descriptions", () => {
  it("only hints fields that exist", () => {
    const known = new Set(COLLECTIONS.flatMap((c) => c.fields.map((f) => `${c.key}.${f.key}`)));
    expect(Object.keys(FIELD_HINTS).filter((k) => !known.has(k))).toEqual([]);
  });

  it("types update patches like the add form, with units in the descriptions", async () => {
    const { ctx } = ctxWith();
    const list = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const tools = (list!.result as { tools: { name: string; inputSchema: { properties: Record<string, { properties?: Record<string, { description: string }>; required?: unknown }> } }[] }).tools;
    const patch = tools.find((t) => t.name === "update_games")!.inputSchema.properties.patch;
    expect(patch.properties!.hltb.description).toMatch(/HowLongToBeat.*hours/);
    expect(patch.required).toBeUndefined();
    const add = tools.find((t) => t.name === "add_movies")!.inputSchema.properties.items as unknown as { items: { properties: Record<string, { description: string }> } };
    expect(add.items.properties.runtime.description).toMatch(/minutes/);
  });
});

describe("MCP trip cards", () => {
  it("accepts the planner's types, statuses and priorities", () => {
    expect(TRIP_CARD_TYPES).toEqual(TYPES.map((t) => t.value));
    expect(TRIP_CARD_STATUSES).toEqual(STATUSES.map((t) => t.value));
    expect(TRIP_CARD_PRIOS).toEqual(PRIOS.map((t) => t.value));
  });
});

describe("MCP protocol", () => {
  it("initializes, lists tools and ignores notifications", async () => {
    const { ctx } = ctxWith();
    const init = await handleRpc({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18" } }, ctx);
    expect((init!.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx)).toBeNull();
    const list = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const names = (list!.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["list_items", "add_expenses", "add_games", "add_books", "update_expenses", "update_games", "delete_items"]));
  });
});

describe("MCP tools", () => {
  it("adds an expense dated today in the user's zone, stored like the form stores it", async () => {
    const { rows, ctx } = ctxWith();
    const r = await call(ctx, "add_expenses", { items: [{ title: " Almuerzo ", category: "Food", amount: "4500" }] });
    expect(r.isError).toBe(false);
    const [g] = [...rows.data.expenses.values()];
    expect(g).toMatchObject({ title: "Almuerzo", type: "expense", category: "Food", amount: 4500, date: dayIn(ctx.now!(), ctx.tz), account: "", notes: "" });
    expect(g.date).toBe("2026-10-31");
    expect(g.id).toMatch(/^x\d+$/);
  });

  it("gives every item of a batch its own id", async () => {
    const { rows, ctx } = ctxWith();
    await call(ctx, "add_expenses", { items: [1, 2, 3].map((n) => ({ title: "SUBE", amount: 5000 * n })) });
    expect(rows.data.expenses.size).toBe(3);
  });

  it("keeps the transfer account only on transfers", async () => {
    const { rows, ctx } = ctxWith();
    await call(ctx, "add_expenses", {
      items: [
        { title: "Ahorro", type: "transfer", account: "Savings", amount: 1000 },
        { title: "Café", account: "Savings", amount: 1000 },
      ],
    });
    expect([...rows.data.expenses.values()].map((g) => g.account)).toEqual(["Savings", ""]);
  });

  it("rejects what the form wouldn't store, with a readable reason", async () => {
    const { rows, ctx } = ctxWith();
    expect((await call(ctx, "add_expenses", { items: [{ title: "X" }] })).text).toMatch(/needs amount/);
    expect((await call(ctx, "add_expenses", { items: [{ title: "X", amount: 1, type: "gift" }] })).text).toMatch(/type must be one of/);
    expect((await call(ctx, "add_expenses", { items: [{ title: "X", amount: 1, date: "31/10/2026" }] })).text).toMatch(/YYYY-MM-DD/);
    expect((await call(ctx, "add_games", { items: [{ title: "Hades", genre: "rogue" }] })).text).toMatch(/Unknown field\(s\) genre/);
    expect(rows.data.expenses?.size ?? 0).toBe(0);
  });

  it("adds a game with the form's defaults", async () => {
    const { rows, ctx } = ctxWith();
    await call(ctx, "add_games", { items: [{ title: "Hades II", status: "playing", tags: "roguelike, indie" }] });
    const [g] = [...rows.data.games.values()];
    expect(g).toMatchObject({ title: "Hades II", status: "playing", tags: ["roguelike", "indie"], owned: false, score: null });
  });

  it("lists a month newest first, filtered by text", async () => {
    const tx = (id: string, date: string, title: string): Item => ({ id, date, title, type: "expense", amount: 1 });
    const { ctx } = ctxWith({ expenses: [tx("a", "2026-09-30", "SUBE"), tx("b", "2026-10-01", "SUBE"), tx("c", "2026-10-31", "Subte"), tx("d", "2026-11-01", "SUBE")] });
    const r = (await call(ctx, "list_items", { collection: "expenses", month: "2026-10" })).json();
    expect(r.items.map((g: Item) => g.id)).toEqual(["c", "b"]);
    const q = (await call(ctx, "list_items", { collection: "expenses", query: "sube" })).json();
    expect(q.total).toBe(3);
  });

  it("updates only the patched fields and re-checks them", async () => {
    const { rows, ctx } = ctxWith({ expenses: [{ id: "a", date: "2026-10-05", title: "Unknown", type: "expense", category: "Unknown", amount: 15500, account: "", notes: "" }] });
    const r = await call(ctx, "update_expenses", { id: "a", patch: { title: "Levure", category: "Food" } });
    expect(r.isError).toBe(false);
    expect(rows.data.expenses.get("a")).toMatchObject({ title: "Levure", category: "Food", amount: 15500, date: "2026-10-05" });
    expect((await call(ctx, "update_expenses", { id: "a", patch: { amount: "lots" } })).isError).toBe(true);
  });

  it("summarizes a month by category against the month before", async () => {
    const tx = (id: string, date: string, category: string, amount: number, type = "expense"): Item => ({ id, date, title: id, type, category, amount });
    const { ctx } = ctxWith({
      expenses: [tx("a", "2026-10-02", "Food", 100), tx("b", "2026-10-20", "Food", 50), tx("c", "2026-10-05", "Transport", 30), tx("d", "2026-10-01", "Salary", 1000, "income"), tx("e", "2026-09-10", "Food", 80), tx("f", "2026-09-11", "Health", 20)],
    });
    const r = (await call(ctx, "summarize_expenses", {})).json(); // this month in BA is 2026-10
    expect(r).toMatchObject({ month: "2026-10", income: 1000, expense: 180, net: 820, previous: { month: "2026-09", expense: 100 } });
    expect(r.expensesBy).toEqual([
      { category: "Food", total: 150, count: 2, previous: 80 },
      { category: "Transport", total: 30, count: 1, previous: 0 },
      { category: "Health", total: 0, count: 0, previous: 20 },
    ]);
  });

  it("reconciles a statement: same amount within a day counts, whatever the name", async () => {
    const tx = (id: string, date: string, title: string, amount: number): Item => ({ id, date, title, type: "expense", amount });
    const { ctx } = ctxWith({ expenses: [tx("a", "2026-10-09", "Farmacia", 6949.94), tx("b", "2026-10-20", "Super", 4354), tx("c", "2026-10-15", "Kiosco", 900)] });
    const r = (
      await call(ctx, "reconcile_statement", {
        movements: [
          { date: "2026-10-10", description: "FARMACIA FINOCHIETTO", amount: 6949.94 },
          { date: "2026-10-20", description: "DIA TIENDA", amount: 4354 },
          { date: "2026-10-20", description: "DIA TIENDA", amount: 4354 },
          { date: "2026-10-13", description: "SUBE", amount: 5000 },
        ],
      })
    ).json();
    expect(r.matched).toBe(2);
    expect(r.missing.map((m: { description: string }) => m.description)).toEqual(["DIA TIENDA", "SUBE"]);
    expect(r.appOnly.map((g: Item) => g.id)).toEqual(["c"]);
  });

  it("suggests recurring expenses missing from the month", async () => {
    const tx = (id: string, date: string, title: string, amount: number): Item => ({ id, date, title, type: "expense", category: "Home", account: "", amount });
    const { ctx } = ctxWith({
      expenses: [
        tx("a", "2026-08-31", "Alquiler", 300), tx("b", "2026-09-30", "Alquiler", 320),
        tx("c", "2026-08-05", "Internet", 20), tx("d", "2026-09-05", "internet", 20), tx("e", "2026-10-04", "Internet", 22),
        tx("f", "2026-09-12", "Cine", 10),
      ],
    });
    const r = (await call(ctx, "recurring_expenses", { month: "2026-11" })).json();
    expect(r.suggestions).toEqual([
      expect.objectContaining({ title: "Internet", amount: 22, date: "2026-11-04", monthsSeen: 3 }),
      { title: "Alquiler", type: "expense", category: "Home", account: "", amount: 320, date: "2026-11-30", monthsSeen: 2 },
    ]);
    const oct = (await call(ctx, "recurring_expenses", { month: "2026-10" })).json();
    expect(oct.suggestions.map((s: Item) => s.title)).toEqual(["Alquiler"]);
  });

  it("gives backlog stats and picks from the backlog within a length", async () => {
    const { ctx } = ctxWith({
      games: [
        { id: "a", title: "A", status: "backlog", tags: ["indie"], hltb: 5, score: null },
        { id: "b", title: "B", status: "backlog", tags: ["rpg"], hltb: 80, score: null },
        { id: "c", title: "C", status: "played", tags: ["indie"], yearCompleted: 2026, score: 8 },
        { id: "d", title: "D", status: "played", tags: [], yearCompleted: 2025, score: 6 },
      ],
    });
    const s = (await call(ctx, "backlog_stats", { collection: "games" })).json();
    expect(s.games).toMatchObject({ total: 4, byStatus: { backlog: 2, played: 2 }, finishedThisYear: 1, averageScore: 7, topTags: [{ tag: "indie", count: 2 }, { tag: "rpg", count: 1 }] });
    const p = (await call(ctx, "pick_next", { collection: "games", max_length: 10 })).json();
    expect(p.picks.map((g: Item) => g.id)).toEqual(["a"]);
    expect((await call(ctx, "pick_next", { collection: "games", tags: ["RPG"] })).json().picks[0].id).toBe("b");
  });

  it("lists trips and adds cards after the existing ones", async () => {
    const { rows, ctx } = ctxWith({
      trips: [{ id: "t1", name: "Japón", start: "2027-04-01", end: "2027-04-10", dayCount: 10, currency: "¥", budget: 1000 }],
      trip_cards: [{ id: "c1", trip: "t1", title: "Senso-ji", type: "place", status: "booked", price: 300, day: 1, order: 0 }],
    });
    expect((await call(ctx, "list_trips", {})).json()).toEqual([expect.objectContaining({ id: "t1", spent: 300, cards: 1, byStatus: { booked: 1 } })]);
    const r = await call(ctx, "add_trip_cards", { trip: "t1", cards: [{ title: "Ichiran", type: "food", tags: "ramen, shibuya" }, { title: "Ryokan", type: "lodging", day: 3, price: 200 }] });
    expect(r.isError).toBe(false);
    const added = [...rows.data.trip_cards.values()].filter((c) => c.id !== "c1");
    expect(added).toEqual([
      expect.objectContaining({ trip: "t1", title: "Ichiran", status: "idea", priority: "nice", tags: ["ramen", "shibuya"], day: null, order: 1 }),
      expect.objectContaining({ title: "Ryokan", day: 3, price: 200, order: 2 }),
    ]);
    expect(added[0].id).toMatch(/^c\d+/);
    const list = (await call(ctx, "list_trip_cards", { trip: "t1" })).json();
    expect(list.cards.map((c: Item) => c.title)).toEqual(["Senso-ji", "Ryokan", "Ichiran"]);
    await call(ctx, "update_trip_card", { id: added[0].id, patch: { status: "booked", day: 2 } });
    expect(rows.data.trip_cards.get(added[0].id)).toMatchObject({ status: "booked", day: 2, trip: "t1" });
    expect((await call(ctx, "add_trip_cards", { trip: "t1", cards: [{ title: "X", type: "bar" }] })).text).toMatch(/type must be one of/);
    expect((await call(ctx, "add_trip_cards", { trip: "nope", cards: [{ title: "X" }] })).text).toMatch(/No trip/);
  });

  it("deletes only with confirm: true", async () => {
    const { rows, ctx } = ctxWith({ games: [{ id: "a", title: "X" }] });
    expect((await call(ctx, "delete_items", { collection: "games", ids: ["a"], confirm: false })).isError).toBe(true);
    expect(rows.data.games.size).toBe(1);
    await call(ctx, "delete_items", { collection: "games", ids: ["a"], confirm: true });
    expect(rows.data.games.size).toBe(0);
  });
});
