import { describe, expect, it } from "vitest";
import { fmtBytes, usageView } from "./admin";

describe("fmtBytes", () => {
  it.each([
    [0, "0 B"], [1023, "1023 B"], [1024, "1.0 KB"], [15 * 1024, "15 KB"],
    [5.5 * 1024 * 1024, "5.5 MB"], [500 * 1024 * 1024, "500 MB"], ["x", "0 B"],
  ])("%s → %s", (n, out) => expect(fmtBytes(n)).toBe(out));
});

describe("usageView", () => {
  it("defaults the quota, sorts users by size and marks the viewer", () => {
    const v = usageView(
      { total_bytes: 50 * 1024 * 1024, users: [{ user_id: "a", email: "a@x", bytes: 100 }, { user_id: "b", email: "b@x", bytes: 400, rows: 12 }] },
      "a",
    );
    expect(v).toMatchObject({ total: "50 MB", limit: "500 MB", pct: "10.0%", pctColor: "var(--accent)" });
    expect(v.users.map((u) => [u.email, u.barW, u.rows, u.isMe])).toEqual([
      ["b@x", "100.0%", "12 rows", false],
      ["a@x", "25.0%", "", true],
    ]);
  });

  it("warns at 60% and alerts at 85%", () => {
    expect(usageView({ total_bytes: 70, limit_bytes: 100 }, null).pctColor).toBe("#e6d19c");
    expect(usageView({ total_bytes: 90, limit_bytes: 100 }, null).pctColor).toBe("#e6a09c");
    expect(usageView({ total_bytes: 900, limit_bytes: 100 }, null).pct).toBe("100.0%");
  });
});
