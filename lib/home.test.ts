// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import type { Item } from "@/lib/collection/types";
import { collectionSummary, readHome, rememberLast, rememberSummary, tripsSummary } from "./home";

afterEach(() => localStorage.clear());

describe("home memory", () => {
  it("keeps the last library and summaries per account", () => {
    rememberLast("a", "books");
    rememberSummary("a", "books", { metrics: [{ value: "12", label: "books" }] });
    rememberLast("b", "wines");
    expect(readHome("a").last).toBe("books");
    expect(readHome("a").libs.books?.metrics[0].value).toBe("12");
    expect(readHome("b")).toEqual({ last: "wines", libs: {} });
  });

  it("ignores missing accounts and bad data", () => {
    rememberLast(null, "games");
    expect(localStorage.length).toBe(0);
    localStorage.setItem("bl_home:a", "{not json");
    expect(readHome("a")).toEqual({ libs: {} });
  });
});

describe("summaries", () => {
  const games = (status: string): Item => ({ id: Math.random().toString(36), title: "g", status }) as Item;

  it("takes the first three strip metrics for a collection", () => {
    const s = collectionSummary("games", COLLECTIONS.games, [games("playing"), games("backlog"), games("playing")]);
    expect(s.metrics.map((m) => [m.value, m.label])).toEqual([
      ["3", "games"],
      ["2", "playing"],
      ["0", "played"],
    ]);
    expect(s.metrics[1].accent).toBe(true);
  });

  it("uses the latest month for expenses", () => {
    const tx = (date: string, type: string, amount: number) => ({ id: date + type, title: "t", date, type, amount }) as unknown as Item;
    const s = collectionSummary("expenses", COLLECTIONS.expenses, [tx("2026-08-03", "expense", 10), tx("2026-09-02", "expense", 40), tx("2026-09-05", "income", 100)]);
    expect(s.metrics.map((m) => m.label)).toEqual(["spent", "saved"]);
    expect(s.metrics[0].value).toBe("$40");
    expect(s.note).toMatch(/2026/);
  });

  it("counts trips and names the next one", () => {
    const now = new Date(2026, 8, 26);
    const s = tripsSummary(
      [
        { id: "1", name: "Japan", start: "2026-10-19" },
        { id: "2", name: "Past", start: "2025-01-01", end: "2025-01-05" },
      ],
      now,
    );
    expect(s.metrics[0]).toMatchObject({ value: "2", label: "trips" });
    expect(s.note).toBe("Next: Japan in 23 days");
    expect(tripsSummary([{ id: "1", name: "Japan", start: "2026-09-20", end: "2026-09-30" }], now).note).toBe("Japan · on the road");
  });
});
