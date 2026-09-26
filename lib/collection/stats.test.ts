import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { buildWidget, metric } from "./stats";
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
