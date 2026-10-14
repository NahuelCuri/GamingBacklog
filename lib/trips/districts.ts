// Districts for the Map tab's toggle: OpenStreetMap's administrative
// boundaries around the trip, at whichever level splits it into a handful of
// zones. Countries number their levels differently (Tokyo's wards are level 7,
// Madrid's distritos 9), so the level is picked by how many zones it gives,
// not by country. Fetches go to Overpass; the rest is plain data and maths.
import { withBase } from "@/lib/paths";
import { boxOf, type Box, type LngLat } from "./map-scene";

/** Fewer zones than this says little; more paints the whole map. */
export const MIN_ZONES = 5;
export const MAX_ZONES = 15;

export interface District {
  id: number;
  name: string;
  /** Outer rings, [lng, lat], closed. */
  rings: LngLat[][];
}

export interface Districts {
  level: number;
  zones: District[];
}

interface OsmRelation {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
}

/** How far apart two stops can be and still be in the same city, in km. */
export const CITY_KM = 25;

const kmBetween = ([ax, ay]: LngLat, [bx, by]: LngLat) => {
  const kx = 111.32 * Math.cos((((ay + by) / 2) * Math.PI) / 180);
  return Math.hypot((ax - bx) * kx, (ay - by) * 110.57);
};

/**
 * The stops in the city with the most of them: districts only make sense at
 * city scale, and a box over Tokyo and Osaka would count half of Japan.
 */
export function mainCity(pts: LngLat[]): LngLat[] {
  let best: LngLat[] = [];
  for (const p of pts) {
    const near = pts.filter((q) => kmBetween(p, q) <= CITY_KM);
    if (near.length > best.length) best = near;
  }
  return best;
}

/** Stops with a margin, so the zones around the edge stops count too. */
export function tripBox(pts: LngLat[]): Box {
  const b = boxOf(pts);
  const mx = (b.e - b.w) * 0.15, my = (b.n - b.s) * 0.15;
  return { w: b.w - mx, s: b.s - my, e: b.e + mx, n: b.n + my };
}

const bbox = (b: Box) => [b.s, b.w, b.n, b.e].map((v) => v.toFixed(5)).join(",");

/** Region level down to neighbourhood. */
export const LEVELS = [4, 5, 6, 7, 8, 9, 10];

const level = (lv: number, b: Box) => `relation["boundary"="administrative"]["admin_level"="${lv}"](${bbox(b)});`;

/** How many boundaries each level has in the box: one small count per level, not the boundaries themselves. */
export const countsQuery = (b: Box) => "[out:json][timeout:25];" + LEVELS.map((lv) => level(lv, b) + "out count;").join("");

/** One level's boundaries with their outlines. */
export const shapesQuery = (lv: number, b: Box) => `[out:json][timeout:25];${level(lv, b)}out geom;`;

/** English name when there is one, without a trailing " Ward" ("Ukyō Ward" → "Ukyō"). */
const nameOf = (t: Record<string, string> = {}) => (t["name:en"] || t.name || "").replace(/ Ward$/, "");

/**
 * From the counts (in LEVELS order): the finest level that splits the box into
 * MIN_ZONES–MAX_ZONES zones; failing that, the finest with at least two but
 * fewer than MIN_ZONES. Null when every level is a single zone or too many.
 */
export function pickLevel(json: unknown): number | null {
  const counts = ((json as { elements?: { type: string; tags?: { relations?: string } }[] })?.elements ?? []).filter((e) => e.type === "count");
  if (counts.length !== LEVELS.length) return null;
  const levels = LEVELS.map((lv, i) => [lv, Number(counts[i].tags?.relations) || 0] as const).reverse();
  const fits = levels.find(([, n]) => n >= MIN_ZONES && n <= MAX_ZONES) ?? levels.find(([, n]) => n >= 2 && n < MIN_ZONES);
  return fits ? fits[0] : null;
}

const key = (p: LngLat) => p[0] + "," + p[1];

/** A relation's outer ways joined end to end into closed rings (OSM splits a boundary into many ways). */
export function outerRings(r: OsmRelation): LngLat[][] {
  const ways = (r.members ?? [])
    .filter((m) => m.type === "way" && m.role !== "inner" && (m.geometry?.length ?? 0) > 1)
    .map((m) => m.geometry!.map((g) => [g.lon, g.lat] as LngLat));
  const rings: LngLat[][] = [];
  while (ways.length) {
    let ring = ways.shift()!;
    while (key(ring[0]) !== key(ring[ring.length - 1])) {
      const end = key(ring[ring.length - 1]);
      const i = ways.findIndex((w) => key(w[0]) === end || key(w[w.length - 1]) === end);
      if (i < 0) break;
      const w = ways.splice(i, 1)[0];
      ring = ring.concat((key(w[0]) === end ? w : [...w].reverse()).slice(1));
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

/** Douglas–Peucker on a closed ring: drops points within `tol` degrees of the line (~15 m by default). */
export function simplify(ring: LngLat[], tol = 0.00015): LngLat[] {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, z] = stack.pop()!;
    const [ax, ay] = ring[a], [zx, zy] = ring[z];
    const dx = zx - ax, dy = zy - ay, len = Math.hypot(dx, dy);
    let far = -1, max = tol;
    for (let i = a + 1; i < z; i++) {
      const [px, py] = ring[i];
      const d = len ? Math.abs(dy * px - dx * py + zx * ay - zy * ax) / len : Math.hypot(px - ax, py - ay);
      if (d > max) {
        max = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, z]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  // A ring whose start and end coincide has no chord to measure from; keep it whole if it collapsed.
  return out.length >= 4 ? out : ring;
}

/** The named zones from an `out geom` answer, with their outlines joined and simplified. */
export function zonesOf(json: unknown): District[] {
  return ((json as { elements?: OsmRelation[] })?.elements ?? []).flatMap((r) => {
    const rings = r.type === "relation" && nameOf(r.tags) ? outerRings(r).map((g) => simplify(g)) : [];
    return rings.length ? [{ id: r.id, name: nameOf(r.tags), rings }] : [];
  });
}

/** Even–odd ray cast: is the point inside the closed ring? */
function inRing([x, y]: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How many of the stops fall in each zone, by zone id (zones with none are left out). */
export function stopsIn(zones: District[], pts: LngLat[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of pts) {
    const z = zones.find((z) => z.rings.some((r) => inRing(p, r)));
    if (z) counts.set(z.id, (counts.get(z.id) ?? 0) + 1);
  }
  return counts;
}

const OVERPASS = "https://overpass-api.de/api/interpreter";
const CACHE = "trip-districts:v1:";

/**
 * Overpass answers 429, or 504 "too busy", when it's loaded (often, at peak
 * hours); a few retries, further apart each time, usually get through.
 */
export async function overpass(q: string, signal?: AbortSignal, tries = 4): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // Overpass turns away clients that don't say who they are; a browser sends its own User-Agent.
  if (typeof window === "undefined") headers["User-Agent"] = "GamingBacklog trip map (github.com/NahuelCuri/GamingBacklog)";
  const r = await fetch(OVERPASS, { method: "POST", body: "data=" + encodeURIComponent(q), headers, signal });
  if (r.ok) return r.json();
  if (tries > 1 && (r.status === 429 || r.status === 504)) {
    await new Promise((ok) => setTimeout(ok, (5 - tries) * 2500));
    if (!signal?.aborted) return overpass(q, signal, tries - 1);
  }
  throw new Error("overpass " + r.status);
}

/** A city's districts kept in the site (public/districts, written by scripts/districts.ts). */
export interface Bundle {
  name: string;
  file: string;
  /** The area the file covers. */
  box: Box;
}

const zoneBox = (z: District): Box => {
  const pts = z.rings.flat();
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { w: Math.min(...xs), s: Math.min(...ys), e: Math.max(...xs), n: Math.max(...ys) };
};
const meets = (a: Box, b: Box) => a.w < b.e && a.e > b.w && a.s < b.n && a.n > b.s;

/** The kept city whose area holds the stops' box centre. */
export function pickBundle(list: Bundle[], b: Box): Bundle | undefined {
  const x = (b.w + b.e) / 2, y = (b.s + b.n) / 2;
  return list.find((k) => x > k.box.w && x < k.box.e && y > k.box.s && y < k.box.n);
}

/** A kept city's districts, cut down to those reaching into the box. */
export const zonesNear = (d: Districts, b: Box): Districts => ({ level: d.level, zones: d.zones.filter((z) => meets(zoneBox(z), b)) });

let bundles: Promise<Bundle[]> | null = null;
const bundleList = () =>
  (bundles ??= fetch(withBase("/districts/index.json"))
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []));

/**
 * Districts around the stops (those in their main city): from the ones kept
 * in the site when it has their city, else this browser's cache, else two
 * Overpass queries (only a find is cached). Null when no level fits.
 */
export async function loadDistricts(pts: LngLat[], signal?: AbortSignal): Promise<Districts | null> {
  const b = tripBox(mainCity(pts));
  const kept = pickBundle(await bundleList(), b);
  if (kept) {
    const d = await fetch(withBase("/districts/" + kept.file), { signal }).then((r) => (r.ok ? (r.json() as Promise<Districts>) : null)).catch(() => null);
    const near = d && zonesNear(d, b);
    if (near?.zones.length) return near;
  }
  const k = CACHE + bbox(b);
  try {
    const hit = localStorage.getItem(k);
    if (hit) return JSON.parse(hit) as Districts;
  } catch {
    /* storage blocked */
  }
  const lv = pickLevel(await overpass(countsQuery(b), signal));
  const found = lv ? { level: lv, zones: zonesOf(await overpass(shapesQuery(lv, b), signal)) } : null;
  if (!found?.zones.length) return null;
  try {
    localStorage.setItem(k, JSON.stringify(found));
  } catch {
    /* full or blocked: fetch again next time */
  }
  return found;
}
