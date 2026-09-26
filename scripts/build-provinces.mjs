// Builds public/geo/ar-provinces.json from the province GeoJSON legacy fetched
// at runtime (~13 MB). Applies legacy's own vertex decimation (GeoMap.dc.html
// `simplify`, tolerance 0.018°) ahead of time and keeps only the name, so the
// map ships a small static file instead of downloading the full dataset.
// Usage: node scripts/build-provinces.mjs
import fs from "node:fs";

const SRC = "https://cdn.jsdelivr.net/gh/jazzido/Polymaps-Argentina@master/provincias.json";
const OUT = new URL("../public/geo/ar-provinces.json", import.meta.url);
const TOL = 0.018;

function ring(r) {
  if (!r || r.length < 6) return r;
  const t2 = TOL * TOL;
  const out = [r[0]];
  for (let i = 1; i < r.length - 1; i++) {
    const a = out[out.length - 1], b = r[i], dx = a[0] - b[0], dy = a[1] - b[1];
    if (dx * dx + dy * dy >= t2) out.push(b);
  }
  out.push(r[r.length - 1]);
  return out.length < 4 ? r : out;
}

const round = (r) => r.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

const src = await (await fetch(SRC)).json();
const features = src.features.map((f) => {
  const g = f.geometry;
  const coordinates =
    g.type === "Polygon" ? g.coordinates.map((r) => round(ring(r))) : g.coordinates.map((p) => p.map((r) => round(ring(r))));
  const p = f.properties || {};
  return { type: "Feature", properties: { provincia: p.provincia || p.nombre || p.name || "" }, geometry: { type: g.type, coordinates } };
});
fs.writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", source: SRC, features }));
console.log(features.length, "features,", fs.statSync(OUT).size, "bytes");
