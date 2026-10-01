import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { buildWidget, daysBetween, metric } from "./stats";
import type { Item, MoneyDonutSpec } from "./types";

describe("category split (dynamic money donut)", () => {
  const cfg = COLLECTIONS.expenses;
  const spec = cfg.stats.right.find((w): w is MoneyDonutSpec => w.kind === "moneyDonut" && !!w.dynamicGroup)!;
  const tx = (id: string, category: unknown, amount: number): Item => ({ id, type: "expense", category, amount, date: "2026-09-01" });

  it("keeps one 'Other' slice and counts every expense exactly once", () => {
    const items = [
      ...["Food", "Rent", "Games", "Subs", "Health", "Transport", "Travel", "Gifts", "Pets", "Books"].map((c, i) => tx("c" + i, c, 100 - i)),
      tx("o1", "Other", 50),
      tx("b1", "", 7),
      tx("b2", null, 3),
      tx("s1", " Food ", 5),
    ];
    const w = buildWidget(cfg, items, spec, { accent: "#8ecfd6" });
    if (w?.kind !== "moneyDonut") throw new Error("expected a money donut");
    const labels = w.legend.map((l) => l.label);
    expect(labels.filter((l) => l === "Other")).toHaveLength(1);
    expect(new Set(labels).size).toBe(labels.length);
    const total = items.reduce((a, x) => a + (x.amount as number), 0);
    expect(w.centerValue).toBe("$" + total.toLocaleString("en-US"));
    expect(w.legend.find((l) => l.label === "Food")!.amount).toBe("$105");
  });
});

describe("games spending donut", () => {
  const cfg = COLLECTIONS.games;
  const spec = cfg.stats.right.find((w): w is MoneyDonutSpec => w.kind === "moneyDonut")!;
  const items: Item[] = [
    // bought in 2025, finished in 2026: counts in 2025
    { id: "a", platform: "Steam", price: 20, purchaseDate: "2025-11-03", yearCompleted: "2026" },
    // no purchase date: falls back to the year completed
    { id: "b", platform: "Steam", price: 10, yearCompleted: "2024" },
    { id: "c", platform: "Pirated", price: 60, purchaseDate: "2025-02-10" },
    { id: "d", platform: "GamePass", price: 70, purchaseDate: "2025-06-01" },
    // neither: only in "All"
    { id: "e", platform: "Steam", price: 5 },
  ];
  const donut = (spendYear: string) => {
    const w = buildWidget(cfg, items, spec, { accent: "#9ce6b0", spendYear });
    if (w?.kind !== "moneyDonut") throw new Error("expected a money donut");
    return w;
  };

  it("files spending under the purchase year, else the year completed", () => {
    expect(donut("all").yearOptions.map((o) => o.value)).toEqual(["all", "2025", "2024"]);
    expect(donut("2025").legend.map((l) => l.amount)).toEqual(["$20", "$60", "$70"]);
    expect(donut("2024").legend.map((l) => l.amount)).toEqual(["$10", "$0", "$0"]);
  });

  it("centers on what was paid, not on piracy or Game Pass", () => {
    expect(donut("all").centerValue).toBe("$35");
    expect(donut("2025").centerValue).toBe("$20");
  });
});

describe("metrics with numbers stored as text", () => {
  it("sums and averages numeric strings instead of concatenating", () => {
    const cfg = COLLECTIONS.games;
    const items: Item[] = [
      { id: "1", hours: 10, score: 8 },
      { id: "2", hours: "12", score: "6" },
      { id: "3", hours: null, score: "" },
    ];
    const sum = cfg.stats.summary.find((s) => s.kind === "sum")!;
    const avg = cfg.stats.summary.find((s) => s.kind === "avg")!;
    expect(metric(cfg, items, sum).num).toBe(22);
    expect(metric(cfg, items, avg).value).toBe("7.0");
  });
});

describe("games time and value stats", () => {
  const cfg = COLLECTIONS.games;
  const items: Item[] = [
    { id: "a", title: "A", status: "played", platform: "Steam", price: 20, hours: 40, hltb: 30, purchaseDate: "2024-03-10", releaseDate: "2020-01-01", yearCompleted: "2024" },
    { id: "b", title: "B", status: "played", platform: "Steam", price: 30, hours: 10, hltb: 10, purchaseDate: "2025-05-01", releaseDate: "2025-02-01", yearCompleted: "2025", score: 9 },
    { id: "c", title: "C", status: "played", platform: "GamePass", price: 70, hours: 5, hltb: 15, releaseDate: "2023-01-01", yearCompleted: "2024", score: 7 },
    { id: "d", title: "D", status: "backlog", platform: "Steam", price: 15, hltb: 25, purchaseDate: "2023-01-20" },
    { id: "e", title: "E", status: "backlog", platform: "Pirated", price: 60, hltb: 12, purchaseDate: "2025-12-01" },
  ];
  const now = new Date(2026, 9, 1);
  const widget = (title: string) => {
    const spec = [...cfg.stats.left, ...cfg.stats.right].find((w) => w.title === title)!;
    const w = buildWidget(cfg, items, spec, { accent: "#9ce6b0" }, now);
    if (w?.kind !== "barList" && w?.kind !== "trend" && w?.kind !== "diverging") throw new Error("unexpected widget " + w?.kind);
    return w;
  };
  const rows = (title: string) => {
    const w = widget(title);
    if (w.kind !== "barList" && w.kind !== "diverging") throw new Error("expected bar rows");
    return w.rows.map((r) => [r.label, r.val]);
  };
  const summary = (label: string) => metric(cfg, items, cfg.stats.summary.find((s) => s.label === label)!).value;

  it("summarises backlog hours, pace and cost per hour", () => {
    expect(summary("Backlog hours")).toBe("37");
    // 55h played over 55h HLTB
    expect(summary("Pace vs HLTB")).toBe("0%");
    // paid games with hours: $50 over 50h; Game Pass is left out
    expect(summary("Cost / hour")).toBe("$1.00");
  });

  it("ranks games by hours over HLTB and by cost per hour", () => {
    expect(rows("Hours vs HLTB · biggest gaps")).toEqual([["A", "+10h"], ["C", "-10h"]]);
    const gaps = widget("Hours vs HLTB · biggest gaps");
    if (gaps.kind !== "diverging") throw new Error("expected diverging bars");
    expect(gaps.rows.map((r) => [r.neg, r.pct])).toEqual([[false, "100%"], [true, "100%"]]);
    expect(rows("Best value · cost per hour")).toEqual([["A", "$0.50/h"], ["B", "$3.00/h"]]);
  });

  it("ages the backlog from the purchase date", () => {
    expect(rows("Longest in backlog")).toEqual([["D", "3y 8m"], ["E", "10m"]]);
  });

  it("buckets years between release and completion", () => {
    expect(rows("Played after release")).toEqual([["Same year", "1"], ["1 year", "1"], ["2–3 years", "0"], ["4–6 years", "1"], ["7+ years", "0"]]);
  });

  it("rates platforms, a plain field, like tags", () => {
    expect(rows("Platforms by rating")).toEqual([["Steam · 3", "★9.0"], ["GamePass · 1", "★7.0"]]);
  });

  it("spends by purchase year, falling back to the year completed, paid games only", () => {
    const w = widget("Spending by year");
    if (w.kind !== "trend") throw new Error("expected a trend");
    expect(w.bars.map((b) => [b.label, b.amount])).toEqual([["2023", "$15"], ["2024", "$20"], ["2025", "$30"]]);
  });
});

describe("ratio metrics without data", () => {
  it("show a dash instead of zero", () => {
    const cfg = COLLECTIONS.games;
    const items: Item[] = [{ id: "a", platform: "Steam", hours: 10 }];
    const value = (label: string) => metric(cfg, items, cfg.stats.summary.find((s) => s.label === label)!).value;
    expect(value("Cost / hour")).toBe("—");
    expect(value("Pace vs HLTB")).toBe("—");
  });
});

describe("books reading stats", () => {
  const cfg = COLLECTIONS.books;
  const items: Item[] = [
    // 300 pages over 10 days
    { id: "a", title: "A", author: "Ann", status: "finished", pages: 300, score: 9, started: "2025-01-01", finished: "2025-01-10", dateAdded: "2024-12-01" },
    // finished the day it started: 1 day
    { id: "b", title: "B", author: "Ann", status: "finished", pages: 100, score: 7, started: "2026-03-05", finished: "2026-03-05" },
    // no start date: no rate, still counts by year
    { id: "c", title: "C", author: "Bo", status: "finished", pages: 200, finished: "2026-06-01" },
    { id: "d", title: "D", author: "Bo", status: "reading", pages: 400, started: "2026-07-15" },
    { id: "e", title: "E", author: "Cy", status: "backlog", pages: 250, dateAdded: "2023-09-01" },
  ];
  const now = new Date(2026, 9, 1);
  const all = [...cfg.stats.left, ...cfg.stats.right];
  const widget = (title: string) => buildWidget(cfg, items, all.find((w) => w.title === title)!, { accent: "#d8b98f" }, now);
  const rows = (title: string) => {
    const w = widget(title);
    if (w?.kind !== "barList") throw new Error("expected a bar list");
    return w.rows.map((r) => [r.label, r.val]);
  };

  it("counts both ends of a reading span", () => {
    expect(daysBetween(items[0], { from: "started", to: "finished" })).toBe(10);
    expect(daysBetween(items[1], { from: "started", to: "finished" })).toBe(1);
    expect(daysBetween(items[2], { from: "started", to: "finished" })).toBe(0);
    expect(daysBetween({ id: "x", started: "2026-02-01", finished: "2026-01-01" }, { from: "started", to: "finished" })).toBe(0);
  });

  it("averages pages per day over finished books with both dates", () => {
    // 400 pages over 11 days
    expect(metric(cfg, items, cfg.stats.summary.find((s) => s.label === "Pages / day")!).value).toBe("36");
  });

  it("ranks reads by pace", () => {
    expect(rows("Fastest reads · pages/day")).toEqual([["B", "100/day"], ["A", "30/day"]]);
    expect(rows("Slowest reads · pages/day")).toEqual([["A", "30/day"], ["B", "100/day"]]);
  });

  it("counts authors and rates them with at least two books", () => {
    expect(rows("Top authors").slice(0, 2)).toEqual([["Ann", "2"], ["Bo", "2"]]);
    expect(rows("Authors by rating")).toEqual([["Ann · 2", "★8.0"]]);
  });

  it("ages current reads and the backlog", () => {
    expect(rows("Reading for")).toEqual([["D", "2m"]]);
    expect(rows("Longest in backlog")).toEqual([["E", "3y 1m"]]);
  });

  it("files finished books and pages by the year they were finished", () => {
    const byYear = widget("Finished by year");
    if (byYear?.kind !== "byYear") throw new Error("expected by-year bars");
    expect(byYear.bars.map((b) => [b.label, b.count])).toEqual([["2025", 1], ["2026", 2]]);
    const pages = widget("Pages read by year");
    if (pages?.kind !== "trend") throw new Error("expected a trend");
    expect(pages.bars.map((b) => [b.label, b.amount])).toEqual([["2025", "300"], ["2026", "300"]]);
  });
});

describe("movies stats", () => {
  const cfg = COLLECTIONS.movies;
  const items: Item[] = [
    { id: "a", title: "A", type: "Movie", status: "completed", runtime: 120, rating: 9, imdb: 7.5, director: "Kim", cast: ["X", "Y"], watchedOn: "Cinema" },
    { id: "b", title: "B", type: "Movie", status: "completed", runtime: 90, rating: 6, imdb: 8, director: "Kim", cast: ["X"], watchedOn: "Home" },
    // series: no runtime, so no hours
    { id: "c", title: "C", type: "Series", status: "completed", rating: 8, imdb: 8, director: "", watchedOn: "Home" },
    { id: "d", title: "D", type: "Movie", status: "backlog", runtime: 150, imdb: 7, dateAdded: "2025-04-01" },
  ];
  const now = new Date(2026, 9, 1);
  const all = [...cfg.stats.left, ...cfg.stats.right];
  const widget = (title: string) => buildWidget(cfg, items, all.find((w) => w.title === title)!, { accent: "#a9aee0" }, now);
  const rows = (title: string) => {
    const w = widget(title);
    if (w?.kind !== "barList" && w?.kind !== "diverging") throw new Error("expected bar rows");
    return w.rows.map((r) => [r.label, r.val]);
  };
  const summary = (label: string) => metric(cfg, items, cfg.stats.summary.find((s) => s.label === label)!).value;

  it("sums film hours watched and the mean gap to IMDb", () => {
    // 210 minutes of completed films
    expect(summary("Hours of film")).toBe("4");
    // (+1.5 − 2 + 0) / 3
    expect(summary("Vs IMDb")).toBe("-0.2");
  });

  it("shows where my rating parts from IMDb, both ways", () => {
    expect(rows("Me vs IMDb · biggest gaps")).toEqual([["B", "-2"], ["A", "+1.5"]]);
  });

  it("ranks directors and cast, skipping blanks", () => {
    expect(rows("Top directors")).toEqual([["Kim", "2"]]);
    expect(rows("Directors by rating")).toEqual([["Kim · 2", "★7.5"]]);
    expect(rows("Cast by rating")).toEqual([["X · 2", "★7.5"]]);
  });

  it("rates by type and by where it was watched", () => {
    expect(rows("Type by rating")).toEqual([["Series · 1", "★8.0"], ["Movie · 3", "★7.5"]]);
    expect(rows("Rating by where watched")).toEqual([["Cinema · 1", "★9.0"], ["Home · 2", "★7.0"]]);
  });

  it("ages the backlog", () => {
    expect(rows("Longest in backlog")).toEqual([["D", "1y 6m"]]);
  });
});
