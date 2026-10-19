// Per-user library visibility (Settings). Uses the legacy keys and value shape
// as-is, so the old and new app stay in sync while both are live:
//   backlog:libs:<uid>      visible library keys
//   backlog:libsSeen:<uid>  every library that existed when last saved
import { LIBRARY_KEYS, type LibraryKey } from "@/config/libraries";

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

/**
 * Trips used to be members-only, yet "seen" listed it for everyone, so a saved
 * list without it doesn't mean the user hid it. This marker in "seen" says
 * trips was really on offer; until it's there, trips counts as new.
 */
const TRIPS_OPEN = "trips:open";

function markSeen(storage: KeyValueStorage, uid: string | null) {
  try {
    storage.setItem(seenKey(uid), JSON.stringify([...LIBRARY_KEYS, TRIPS_OPEN]));
  } catch {}
}

/**
 * Visible libraries, in picker order. Libraries added since the user last
 * saved default to visible; ones they hid stay hidden.
 */
export function loadVisibleLibs(storage: KeyValueStorage, uid: string | null): LibraryKey[] {
  const saved = readArray(storage, libsKey(uid));
  if (saved && saved.length) {
    const seen = readArray(storage, seenKey(uid)) ?? [];
    const wasSeen = (k: LibraryKey) => seen.includes(k) && (k !== "trips" || seen.includes(TRIPS_OPEN));
    const next = LIBRARY_KEYS.filter((k) => saved.includes(k) || !wasSeen(k));
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
