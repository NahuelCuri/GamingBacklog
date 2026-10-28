import { describe, expect, it } from "vitest";
import { books } from "@/config/collections/books";
import type { Item } from "@/lib/collection/types";
import { goalHistory, goalProgress, memoryGoalStore, yearElapsed } from "./goals";

const goal = books.goal!;
const book = (id: string, status: string, finished = "", pages = 100): Item => ({ id, title: id, status, finished, pages });

const items: Item[] = [
  book("a", "finished", "2026-01-20", 300),
  book("b", "finished", "2026-03-02", 200),
  book("c", "finished", "2026-03-28"),
  book("d", "finished", "2025-12-31"),
  book("e", "finished", ""),
  book("f", "reading"),
  book("g", "reading"),
  book("h", "backlog"),
];

describe("goalProgress", () => {
  // July 2 is day 183 of 2026 (~50%).
  const today = new Date(2026, 6, 2);

  it("counts what was finished in the year, by its date", () => {
    const p = goalProgress(goal, items, 2026, 12, today);
    expect(p.count).toBe(3);
    expect(p.extra).toBe(600);
    expect(p.months.slice(0, 4)).toEqual([1, 0, 2, 0]);
    expect(p.undated.map((g) => g.id)).toEqual(["e"]);
    expect(p.inProgress).toBe(2);
  });

  it("measures pace against an even spread over the year", () => {
    // 12 a year, half gone: 6 due, 3 done.
    expect(goalProgress(goal, items, 2026, 12, today).ahead).toBe(-3);
    // 5.01 due rounds down: 3 done of 5 is 2 behind, not 3.
    expect(goalProgress(goal, items, 2026, 10, today).ahead).toBe(-2);
    expect(goalProgress(goal, items, 2026, 4, today).ahead).toBe(1);
  });

  it("spreads what's left over the months left, this month included", () => {
    expect(goalProgress(goal, items, 2026, 15, today).perMonth).toBe(2);
    expect(goalProgress(goal, items, 2026, 3, today).perMonth).toBeNull();
  });

  it("has no pace or in-progress tail for another year", () => {
    const p = goalProgress(goal, items, 2025, 1, today);
    expect(p.count).toBe(1);
    expect(p.ahead).toBeNull();
    expect(p.elapsed).toBeNull();
    expect(p.inProgress).toBe(0);
  });

  it("works without a target", () => {
    const p = goalProgress(goal, items, 2026, null, today);
    expect(p.count).toBe(3);
    expect(p.ahead).toBeNull();
    expect(p.perMonth).toBeNull();
  });
});

describe("yearElapsed", () => {
  it("counts today as done", () => {
    expect(yearElapsed(new Date(2026, 0, 1))).toBeCloseTo(1 / 365);
    expect(yearElapsed(new Date(2026, 11, 31))).toBe(1);
    expect(yearElapsed(new Date(2024, 11, 31))).toBe(1);
  });
});

describe("goalHistory", () => {
  it("lists past years with a goal, newest first", () => {
    const h = goalHistory(goal, items, { 2024: 5, 2025: 1, 2026: 20 }, new Date(2026, 6, 2));
    expect(h).toEqual([
      { year: 2025, target: 1, count: 1, met: true },
      { year: 2024, target: 5, count: 0, met: false },
    ]);
  });
});

describe("memoryGoalStore", () => {
  it("keeps one target per library and year", async () => {
    const s = memoryGoalStore({ books: { 2025: 10 } });
    await s.set("books", 2026, 24);
    await s.set("books", 2026, 30);
    expect(await s.load("books")).toEqual({ 2025: 10, 2026: 30 });
    await s.remove("books", 2025);
    expect(await s.load("books")).toEqual({ 2026: 30 });
    expect(await s.load("games")).toEqual({});
  });
});
