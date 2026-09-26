// What the home picker remembers, per account and per device: the library
// opened last and a few numbers from each library, saved whenever that
// library loads. Read from localStorage only; nothing extra hits the server.
import type { LibraryKey } from "@/config/libraries";
import { buildStrip, monthCards } from "@/lib/collection";
import type { CollectionConfig, CollectionKey, Item } from "@/lib/collection/types";
import type { Trip } from "@/lib/trips/model";
import { usd, type MoneyFormat } from "@/lib/spending";

export interface HomeMetric {
  value: string;
  label: string;
  accent?: boolean;
}

export interface LibSummary {
  metrics: HomeMetric[];
  /** Context under the numbers ("September 2026", "Next: Japan in 23 days"). */
  note?: string;
  /** When it was saved (ms). */
  at: number;
}

export interface HomeMemory {
  last?: LibraryKey;
  libs: Partial<Record<LibraryKey, LibSummary>>;
}

const keyOf = (uid: string) => "bl_home:" + uid;
const empty = (): HomeMemory => ({ libs: {} });

export function readHome(uid: string | null | undefined): HomeMemory {
  if (!uid) return empty();
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(uid)) || "null");
    return v && typeof v === "object" && v.libs && typeof v.libs === "object" ? v : empty();
  } catch {
    return empty();
  }
}

function update(uid: string | null | undefined, fn: (m: HomeMemory) => void) {
  if (!uid) return;
  try {
    const m = readHome(uid);
    fn(m);
    localStorage.setItem(keyOf(uid), JSON.stringify(m));
  } catch {
    /* storage full or blocked: the home page just shows less */
  }
}

export const rememberLast = (uid: string | null | undefined, lib: LibraryKey) =>
  update(uid, (m) => {
    m.last = lib;
  });

export const rememberSummary = (uid: string | null | undefined, lib: LibraryKey, s: Omit<LibSummary, "at">) =>
  update(uid, (m) => {
    m.libs[lib] = { ...s, at: Date.now() };
  });

/** Expenses: the latest month's spent and saved. Others: the first three metrics of the library strip. */
export function collectionSummary(key: CollectionKey, cfg: CollectionConfig, items: Item[], m: MoneyFormat = usd): Omit<LibSummary, "at"> {
  if (key === "expenses") {
    const month = monthCards(cfg, items, m)[0];
    if (!month) return { metrics: [] };
    return {
      metrics: [
        { value: month.spent, label: "spent", accent: true },
        { value: month.saved, label: "saved" },
      ],
      note: month.label,
    };
  }
  const strip = buildStrip(cfg, items, m);
  return {
    metrics: strip.slice(0, 3).map((s, i) => ({ value: s.value, label: s.label, accent: !!cfg.stats.strip[i]?.accent })),
  };
}

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00");

/** Trip count, and the trip under way or the next one coming up. */
export function tripsSummary(trips: Trip[], now: Date = new Date()): Omit<LibSummary, "at"> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dated = trips.filter((t) => t.start && !Number.isNaN(dayOf(t.start)));
  const current = dated.find((t) => dayOf(t.start!) <= today && today <= dayOf(t.end || t.start!));
  const next = dated.filter((t) => dayOf(t.start!) > today).sort((a, b) => dayOf(a.start!) - dayOf(b.start!))[0];
  let note: string | undefined;
  if (current) note = `${current.name} · on the road`;
  else if (next) {
    const days = Math.round((dayOf(next.start!) - today) / DAY);
    note = `Next: ${next.name} in ${days} ${days === 1 ? "day" : "days"}`;
  }
  return { metrics: [{ value: String(trips.length), label: trips.length === 1 ? "trip" : "trips", accent: true }], note };
}
