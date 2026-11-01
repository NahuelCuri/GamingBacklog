import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { blankDraft } from "./draft";

describe("new item's auto date", () => {
  const cfg = COLLECTIONS.expenses;
  const date = (today: Date, month?: string) => blankDraft(cfg, today, month).date;

  it("is today's local date, even late at night", () => {
    // 23:30 local is already the next day in UTC anywhere west of Greenwich.
    expect(date(new Date(2026, 9, 31, 23, 30))).toBe("2026-10-31");
  });

  it("stays today when the month shown is this one", () => {
    expect(date(new Date(2026, 9, 14), "2026-10")).toBe("2026-10-14");
  });

  it("lands in an earlier month shown, on the same day of the month", () => {
    expect(date(new Date(2026, 9, 14), "2026-08")).toBe("2026-08-14");
  });

  it("caps the day at that month's last", () => {
    expect(date(new Date(2026, 9, 31), "2026-09")).toBe("2026-09-30");
    expect(date(new Date(2026, 9, 31), "2026-02")).toBe("2026-02-28");
  });
});
