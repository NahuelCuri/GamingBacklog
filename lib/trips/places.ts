// Place lookups for the card editor's Location field (Nominatim).
import { countryUrl, placesFrom, placeSearchUrl, type BBox, type LatLng, type Place, type TripCard } from "./model";

type Fetch = (url: string, init?: RequestInit) => Promise<{ json(): Promise<unknown> }>;

const HEADERS = { headers: { Accept: "application/json" } };
const CACHE = "trip-country:";
/** Lookups at most per search; a trip's stops rarely span more countries than this. */
const MAX_LOOKUPS = 5;

/** The country a point is in (ISO code, "" if none), remembered per ~10 km cell on this device. */
export async function countryAt(p: LatLng, fetchFn: Fetch = fetch): Promise<string> {
  const key = CACHE + p.lat.toFixed(1) + "," + p.lng.toFixed(1);
  try {
    const hit = localStorage.getItem(key);
    if (hit) return hit;
  } catch {
    /* storage blocked */
  }
  const j = (await (await fetchFn(countryUrl(p), HEADERS)).json()) as { address?: { country_code?: string } } | null;
  const code = String(j?.address?.country_code || "").toLowerCase();
  if (code)
    try {
      localStorage.setItem(key, code);
    } catch {
      /* storage blocked */
    }
  return code;
}

/**
 * The countries the trip's other stops are in: from the cards that know theirs,
 * and a lookup (one per ~10 km cell, a few at most) for located cards that don't.
 * Empty when the trip has no located card yet, or the lookups fail.
 */
export async function tripCountries(cards: TripCard[], exceptId?: string, fetchFn: Fetch = fetch): Promise<string[]> {
  const own = cards.filter((c) => c.id !== exceptId);
  const found = new Set(own.map((c) => c.country || "").filter(Boolean));
  const cells = new Map<string, LatLng>();
  own.forEach((c) => {
    if (c.country || !c.loc || !isFinite(c.loc.lat) || !isFinite(c.loc.lng)) return;
    cells.set(c.loc.lat.toFixed(1) + "," + c.loc.lng.toFixed(1), c.loc);
  });
  for (const p of [...cells.values()].slice(0, MAX_LOOKUPS)) {
    try {
      const code = await countryAt(p, fetchFn);
      if (code) found.add(code);
    } catch {
      /* offline: search without the lock */
    }
  }
  return [...found].sort();
}

/** Places matching a name, optionally only in some countries or inside an area. */
export async function searchPlaces(q: string, scope: { area?: BBox | null; countries?: string[] } = {}, fetchFn: Fetch = fetch): Promise<Place[]> {
  return placesFrom(await (await fetchFn(placeSearchUrl(q, scope), HEADERS)).json());
}
