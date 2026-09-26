// Argentina province map data and matching, ported from legacy GeoMap.dc.html.
// Only the province tier is drawn (23 provinces + CABA). Stats match a province
// by name, accent-insensitive, on the full name or its first comma segment, so a
// wine from "Mendoza, Argentina" lights up Mendoza.
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeoStat } from "@/lib/collection/geo";
import { withBase } from "@/lib/paths";

export interface ProvinceProps {
  provincia: string;
}

export type Province = Feature<Polygon | MultiPolygon, ProvinceProps> & { malvinas?: true };

/** Lon/lat frame: mainland + Malvinas, excluding the Antarctic sector. */
export const AR_BOX: Polygon = {
  type: "Polygon",
  coordinates: [[[-74, -21], [-52.5, -21], [-52.5, -55.4], [-74, -55.4], [-74, -21]]],
};

/**
 * Open province datasets lack the Malvinas, so legacy overlays a simplified
 * two-island feature tagged to Tierra del Fuego: it glows and zooms with that
 * province and keeps the "Includes las Islas Malvinas" copy honest.
 */
export const MALVINAS: Province = {
  type: "Feature",
  malvinas: true,
  properties: { provincia: "Tierra del Fuego" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [[[-58.0, -51.3], [-57.7, -51.6], [-58.0, -51.9], [-57.85, -52.15], [-58.4, -52.35], [-58.9, -52.15], [-58.6, -51.75], [-59.0, -51.55], [-58.6, -51.3], [-58.0, -51.3]]],
      [[[-60.0, -51.35], [-59.6, -51.6], [-59.9, -51.95], [-60.4, -52.05], [-60.9, -51.75], [-61.3, -51.45], [-60.6, -51.3], [-60.0, -51.35]]],
    ],
  },
};

export const norm = (s: unknown) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const provinceName = (f: Province) => f.properties?.provincia || "";
export const provinceLabel = (f: Province) => (f.malvinas ? "Islas Malvinas" : provinceName(f).split(",")[0]);

/** Returns the stat a province matches, if any. */
export function provinceMatcher(stats: GeoStat[]) {
  const byName: Record<string, GeoStat> = {};
  stats.forEach((s) => (byName[norm(s.region)] = s));
  return (f: Province): GeoStat | null => byName[norm(provinceName(f))] || byName[norm(provinceName(f).split(",")[0])] || null;
}

/** Header counters: distinct matched regions and the items placed in them. */
export function placedTotals(features: Province[], stats: GeoStat[]) {
  const hit = provinceMatcher(stats);
  const seen = new Set<string>();
  let provinces = 0, items = 0;
  features.forEach((f) => {
    const s = hit(f);
    if (s && !seen.has(s.region)) {
      seen.add(s.region);
      provinces++;
      items += s.count;
    }
  });
  return { provinces, items };
}

/** Zoom transform that frames `bounds` ([[x0,y0],[x1,y1]] in px) at 70% of the view, capped at 10x. */
export function zoomToBounds([[x0, y0], [x1, y1]]: [[number, number], [number, number]], W: number, H: number) {
  const k = Math.max(1, Math.min(10, 0.7 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
  return { k, x: W / 2 - (k * (x0 + x1)) / 2, y: H / 2 - (k * (y0 + y1)) / 2 };
}

let provincesP: Promise<Province[]> | null = null;

/** The pre-simplified provinces (scripts/build-provinces.mjs) plus the Malvinas overlay. Cached. */
export function loadProvinces(get: typeof fetch = fetch): Promise<Province[]> {
  if (!provincesP) {
    provincesP = get(withBase("/geo/ar-provinces.json"))
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<FeatureCollection<Polygon | MultiPolygon, ProvinceProps>>;
      })
      .then((j) => {
        if (!j.features?.length) throw new Error("no features");
        return [...(j.features as Province[]), MALVINAS];
      })
      .catch((e) => {
        provincesP = null; // let a later visit retry
        throw e;
      });
  }
  return provincesP;
}
