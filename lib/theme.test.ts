import { afterEach, describe, expect, it, vi } from "vitest";
import { readTheme, THEME_KEY } from "./theme";

function stubStorage(value: string | null) {
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === THEME_KEY ? value : null) });
}

describe("readTheme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the legacy key so the stored choice carries over", () => {
    expect(THEME_KEY).toBe("backlog:theme");
  });

  it("reads light", () => {
    stubStorage("light");
    expect(readTheme()).toBe("light");
  });

  it("defaults to dark when missing or unknown", () => {
    stubStorage(null);
    expect(readTheme()).toBe("dark");
    stubStorage("sepia");
    expect(readTheme()).toBe("dark");
  });

  it("defaults to dark when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readTheme()).toBe("dark");
  });
});
