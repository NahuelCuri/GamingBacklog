// Keep a city's districts in the site (public/districts), so the trip map
// reads them from there instead of asking Overpass every time.
//
//   npm run districts -- <name> <south,west,north,east> [level]
//
// Without a level it prints how many boundaries each level has in the box;
// pick the one that splits the city the way you want (Tokyo's wards: 7) and
// run it again with that level. Overpass is often busy: just retry.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS, countsQuery, overpass, shapesQuery, zonesOf, type Bundle } from "@/lib/trips/districts";
import type { Box } from "@/lib/trips/map-scene";

const [name, rawBox, rawLevel] = process.argv.slice(2);
const nums = (rawBox || "").split(",").map(Number);
if (!name || !/^[a-z0-9-]+$/.test(name) || nums.length !== 4 || nums.some((v) => !Number.isFinite(v))) {
  console.error("usage: scripts/districts.ts <name> <south,west,north,east> [level]   (name: lowercase, e.g. tokyo)");
  process.exit(1);
}
const [s, w, n, e] = nums;
const box: Box = { w, s, e, n };

if (!rawLevel) {
  const json = (await overpass(countsQuery(box))) as { elements?: { tags?: { relations?: string } }[] };
  LEVELS.forEach((lv, i) => console.log(`level ${lv}: ${json.elements?.[i]?.tags?.relations ?? "?"} boundaries`));
  console.log("\nRun again with the level to keep.");
  process.exit(0);
}

const level = Number(rawLevel);
const zones = zonesOf(await overpass(shapesQuery(level, box)));
if (!zones.length) {
  console.error(`No named boundaries at level ${level} in that box.`);
  process.exit(1);
}

const dir = join(process.cwd(), "public", "districts");
mkdirSync(dir, { recursive: true });
const file = name + ".json";
writeFileSync(join(dir, file), JSON.stringify({ level, zones }));

const indexPath = join(dir, "index.json");
let index: Bundle[] = [];
try {
  index = JSON.parse(readFileSync(indexPath, "utf8"));
} catch {
  /* first city */
}
index = [...index.filter((b) => b.name !== name), { name, file, box }];
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

const kb = Math.round(JSON.stringify({ level, zones }).length / 1024);
console.log(`${name}: ${zones.length} districts at level ${level} (${kb} KB) → public/districts/${file}`);
console.log(zones.map((z) => z.name).join(", "));
