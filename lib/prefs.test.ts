import { describe, expect, it } from "vitest";
import { LIBRARY_KEYS, TRIP_MEMBERS } from "@/config/libraries";
import { validateCredentials } from "./auth";
import { libsKey, loadVisibleLibs, saveVisibleLibs, seenKey, toggleLib, type KeyValueStorage } from "./prefs";

function mem(init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("library visibility (legacy keys, legacy rules)", () => {
  const uid = "user-1";

  it("uses the legacy key names", () => {
    expect(libsKey(uid)).toBe("backlog:libs:user-1");
    expect(seenKey(null)).toBe("backlog:libsSeen:anon");
  });

  it("shows everything to a new user and records what exists", () => {
    const s = mem();
    expect(loadVisibleLibs(s, uid)).toEqual(LIBRARY_KEYS);
    expect(JSON.parse(s.data[seenKey(uid)])).toEqual(LIBRARY_KEYS);
  });

  it("keeps hidden libraries hidden", () => {
    const s = mem({ [libsKey(uid)]: '["games","books"]', [seenKey(uid)]: JSON.stringify(LIBRARY_KEYS) });
    expect(loadVisibleLibs(s, uid)).toEqual(["games", "books"]);
  });

  it("shows libraries added since the user last saved", () => {
    const s = mem({ [libsKey(uid)]: '["games"]', [seenKey(uid)]: '["games","books","wines"]' });
    expect(loadVisibleLibs(s, uid)).toEqual(["games", "movies", "expenses", "trips"]);
  });

  it("always shows trips to trip members", () => {
    const member = TRIP_MEMBERS[0];
    const s = mem({ [libsKey(member)]: '["games"]', [seenKey(member)]: JSON.stringify(LIBRARY_KEYS) });
    expect(loadVisibleLibs(s, member)).toEqual(["games", "trips"]);
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
