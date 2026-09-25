// Geographic aggregation for the Map tab. Every comma-token of the geo field
// is credited ("Mendoza, Argentina" → Mendoza and Argentina) so the map can
// match at province or country level; the last token is the country.
import { primaryKey } from "./format";
import type { CollectionConfig, Item } from "./types";

export interface GeoStat {
  region: string;
  count: number;
  items: string[];
}

export interface GeoData {
  stats: GeoStat[];
  /** coarse origins (last token), used to lazy-load province layers */
  countries: string[];
  noun: string;
  title: string;
  subtitle: string;
  unmapped: number;
  totalItems: number;
  regionCount: number;
}

export function buildGeo(cfg: CollectionConfig, items: Item[]): GeoData {
  const g = cfg.geo || {};
  const field = g.field || "region";
  const primary = primaryKey(cfg);
  const map: Record<string, GeoStat> = {};
  const countries = new Set<string>();
  let placed = 0;
  items.forEach((it) => {
    const raw = it[field];
    if (!raw) return;
    const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    placed++;
    countries.add(parts[parts.length - 1]);
    parts.forEach((tok) => {
      const bucket = map[tok] || (map[tok] = { region: tok, count: 0, items: [] });
      bucket.count++;
      bucket.items.push(String(it[primary] ?? ""));
    });
  });
  return {
    stats: Object.values(map).sort((a, b) => b.count - a.count),
    countries: [...countries],
    noun: cfg.nounPlural || "items",
    title: g.label || "Origins",
    subtitle: g.subtitle || "",
    unmapped: items.length - placed,
    totalItems: placed,
    regionCount: countries.size,
  };
}
