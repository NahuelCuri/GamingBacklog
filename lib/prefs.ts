// Per-user library visibility (Settings). Uses the legacy keys and value shape
// as-is, so the old and new app stay in sync while both are live:
//   backlog:libs:<uid>      visible library keys
//   backlog:libsSeen:<uid>  every library that existed when last saved
import { LIBRARY_KEYS, isTripMember, type LibraryKey } from "@/config/libraries";

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const libsKey = (uid: string | null) => "backlog:libs:" + (uid || "anon");
export const seenKey = (uid: string | null) => "backlog:libsSeen:" + (uid || "anon");

// Storage may throw (blocked site data) and values may be malformed: both read as "unset".
function readArray(storage: KeyValueStorage, key: string): string[] | null {
  try {
    const v = JSON.parse(storage.getItem(key) ?? "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function markSeen(storage: KeyValueStorage, uid: string | null) {
  try {
    storage.setItem(seenKey(uid), JSON.stringify(LIBRARY_KEYS));
  } catch {}
}

/**
 * Visible libraries, in picker order. Libraries added since the user last
 * saved default to visible; ones they hid stay hidden. Trips is always shown
 * to trip members.
 */
export function loadVisibleLibs(storage: KeyValueStorage, uid: string | null): LibraryKey[] {
  const saved = readArray(storage, libsKey(uid));
  if (saved && saved.length) {
    const seen = readArray(storage, seenKey(uid)) ?? [];
    const fresh = LIBRARY_KEYS.filter((k) => !saved.includes(k) && !seen.includes(k));
    let next = LIBRARY_KEYS.filter((k) => saved.includes(k) || fresh.includes(k));
    if (isTripMember(uid) && !next.includes("trips")) next = LIBRARY_KEYS.filter((k) => next.includes(k) || k === "trips");
    markSeen(storage, uid);
    return next;
  }
  markSeen(storage, uid);
  return [...LIBRARY_KEYS];
}

export function saveVisibleLibs(storage: KeyValueStorage, uid: string | null, libs: LibraryKey[]) {
  try {
    storage.setItem(libsKey(uid), JSON.stringify(libs));
  } catch {}
}

/** Toggle one library; returns null when it would hide the last visible one. */
export function toggleLib(current: LibraryKey[], key: LibraryKey): LibraryKey[] | null {
  if (current.includes(key)) return current.length <= 1 ? null : current.filter((k) => k !== key);
  return LIBRARY_KEYS.filter((k) => current.includes(k) || k === key);
}
