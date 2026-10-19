import { describe, expect, it } from "vitest";
import { LIBRARY_KEYS } from "@/config/libraries";
import { validateCredentials } from "./auth";
import { libsKey, loadVisibleLibs, saveVisibleLibs, seenKey, toggleLib, type KeyValueStorage } from "./prefs";

function mem(init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("library visibility (legacy keys, legacy rules)", () => {
  const uid = "user-1";
  /** What "seen" holds once trips is open to everyone. */
  const SEEN = JSON.stringify([...LIBRARY_KEYS, "trips:open"]);

  it("uses the legacy key names", () => {
    expect(libsKey(uid)).toBe("backlog:libs:user-1");
    expect(seenKey(null)).toBe("backlog:libsSeen:anon");
  });

  it("shows everything to a new user and records what exists", () => {
    const s = mem();
    expect(loadVisibleLibs(s, uid)).toEqual(LIBRARY_KEYS);
    expect(s.data[seenKey(uid)]).toEqual(SEEN);
  });

  it("keeps hidden libraries hidden", () => {
    const s = mem({ [libsKey(uid)]: '["games","books"]', [seenKey(uid)]: SEEN });
    expect(loadVisibleLibs(s, uid)).toEqual(["games", "books"]);
  });

  it("shows libraries added since the user last saved", () => {
    const s = mem({ [libsKey(uid)]: '["games"]', [seenKey(uid)]: '["games","books","wines"]' });
    expect(loadVisibleLibs(s, uid)).toEqual(["games", "movies", "expenses", "trips"]);
  });

  it("shows trips once now that everyone has it, then respects hiding it", () => {
    // Saved while trips was members-only: "seen" listed it but it was never on offer.
    const s = mem({ [libsKey(uid)]: '["games"]', [seenKey(uid)]: JSON.stringify(LIBRARY_KEYS) });
    expect(loadVisibleLibs(s, uid)).toEqual(["games", "trips"]);
    saveVisibleLibs(s, uid, ["games"]);
    expect(loadVisibleLibs(s, uid)).toEqual(["games"]);
  });

  it("treats malformed or throwing storage as unset", () => {
    expect(loadVisibleLibs(mem({ [libsKey(uid)]: "{oops" }), uid)).toEqual(LIBRARY_KEYS);
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadVisibleLibs(broken, uid)).toEqual(LIBRARY_KEYS);
    expect(() => saveVisibleLibs(broken, uid, ["games"])).not.toThrow();
  });

  it("toggles in picker order and never hides the last library", () => {
    expect(toggleLib(["games", "wines"], "books")).toEqual(["games", "books", "wines"]);
    expect(toggleLib(["games", "wines"], "wines")).toEqual(["games"]);
    expect(toggleLib(["games"], "games")).toBeNull();
  });
});

describe("validateCredentials", () => {
  it("matches the legacy messages", () => {
    expect(validateCredentials("", "secret1")).toBe("Enter your email and password.");
    expect(validateCredentials("a@b.c", "")).toBe("Enter your email and password.");
    expect(validateCredentials("a@b.c", "12345")).toBe("Password must be at least 6 characters.");
    expect(validateCredentials("a@b.c", "123456")).toBeNull();
  });
});
