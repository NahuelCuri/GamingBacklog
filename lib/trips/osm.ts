// Street basemap for the trip Map tab: OSM ways from Overpass for the stops'
// bounding box, cached in localStorage (legacy key `trip-map-osm:<bbox>`).
import type { BBox } from "./model";

/** a: motorways/trunks, b: primary, c: other roads, w: waterways, p: water areas, k: parks (unused). */
export interface StreetGeo {
  a: { g: [number, number][] }[];
  b: { g: [number, number][] }[];
  c: { g: [number, number][] }[];
  w: { g: [number, number][] }[];
  p: { g: [number, number][] }[];
  k: { g: [number, number][] }[];
}

export const emptyGeo = (): StreetGeo => ({ a: [], b: [], c: [], w: [], p: [], k: [] });

export const bboxKey = (b: BBox) => [b.s, b.w, b.n, b.e].map((v) => v.toFixed(3)).join(",");
export const cacheKey = (key: string) => "trip-map-osm:" + key;

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

interface OverpassEl {
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Mirrors go down or block CORS individually; try each in turn. A 200 with no elements counts as a failure. */
async function overpass(q: string, get: typeof fetch): Promise<OverpassEl[]> {
  for (const url of MIRRORS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 35000);
    try {
      const r = await get(url, {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
      });
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      if (j?.elements?.length) return j.elements;
    } catch {
      /* next mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("all mirrors failed");
}

function sortInto(geo: StreetGeo, el: OverpassEl) {
  if (!el.geometry || el.geometry.length < 2) return;
  const t = el.tags || {};
  const g = el.geometry.map((p) => [+p.lon.toFixed(5), +p.lat.toFixed(5)] as [number, number]);
  if (t.natural === "water") geo.p.push({ g });
  else if (t.waterway) geo.w.push({ g });
  else if (t.highway === "motorway" || t.highway === "trunk") geo.a.push({ g });
  else if (t.highway === "primary") geo.b.push({ g });
  else if (t.highway) geo.c.push({ g });
}

export function readCachedGeo(key: string): StreetGeo | null {
  try {
    const c = localStorage.getItem(cacheKey(key));
    if (!c) return null;
    const g = JSON.parse(c) as StreetGeo;
    if ((g.a || []).length + (g.b || []).length + (g.c || []).length > 0) return { ...emptyGeo(), ...g };
    localStorage.removeItem(cacheKey(key)); // an empty result is a failed result
  } catch {
    /* ignore */
  }
  return null;
}

function cacheGeo(key: string, geo: StreetGeo) {
  try {
    const s = JSON.stringify(geo);
    if (s.length < 3.2e6) localStorage.setItem(cacheKey(key), s);
  } catch {
    /* quota */
  }
}

export function forgetGeo(key: string) {
  try {
    localStorage.removeItem(cacheKey(key));
  } catch {
    /* ignore */
  }
}

/**
 * Roads first (bundling water into the same query times Overpass out), then a
 * best-effort water pass; `onUpdate` fires again when water arrives. Road
 * detail grows as the box shrinks.
 */
export async function loadStreets(b: BBox, key: string, onUpdate: (g: StreetGeo) => void, get: typeof fetch = fetch): Promise<StreetGeo> {
  const span = Math.max(b.n - b.s, b.e - b.w);
  const hw =
    span > 0.3 ? "motorway|trunk|primary"
    : span > 0.1 ? "motorway|trunk|primary|secondary"
    : span > 0.035 ? "motorway|trunk|primary|secondary|tertiary"
    : "motorway|trunk|primary|secondary|tertiary|residential";
  const box = `${b.s},${b.w},${b.n},${b.e}`;
  const geo = emptyGeo();
  (await overpass(`[out:json][timeout:25];way["highway"~"^(${hw})$"](${box});out geom;`, get)).forEach((el) => sortInto(geo, el));
  if (!(geo.a.length + geo.b.length + geo.c.length)) throw new Error("empty");
  cacheGeo(key, geo);
  const wq =
    span > 0.12
      ? `[out:json][timeout:20];way["waterway"~"^(river|canal)$"](${box});out geom;`
      : `[out:json][timeout:20];(way["waterway"~"^(river|canal)$"](${box});way["natural"="water"](${box}););out geom;`;
  overpass(wq, get)
    .then((els) => {
      els.forEach((el) => sortInto(geo, el));
      cacheGeo(key, geo);
      onUpdate({ ...geo });
    })
    .catch(() => {});
  return geo;
}
