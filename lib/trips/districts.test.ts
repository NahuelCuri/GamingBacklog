import { describe, expect, it } from "vitest";
import { mainCity, outerRings, pickLevel, simplify, tripBox, zonesOf } from "./districts";
import type { LngLat } from "./map-scene";

const counts = (...n: number[]) => ({ elements: n.map((relations, id) => ({ type: "count", id, tags: { relations: String(relations) } })) });

describe("district level", () => {
  // Levels 4 to 10, in order.
  it("is the finest level with 5 to 15 zones in the box", () => {
    expect(pickLevel(counts(1, 0, 1, 8, 12, 40, 300))).toBe(8);
    expect(pickLevel(counts(1, 0, 1, 15, 0, 391, 857))).toBe(7);
  });

  it("falls back to a few zones, and to nothing when every level is one zone or too many", () => {
    expect(pickLevel(counts(1, 0, 1, 3, 30, 0, 0))).toBe(7);
    expect(pickLevel(counts(1, 0, 1, 1, 30, 0, 0))).toBeNull();
    expect(pickLevel(counts(1, 2))).toBeNull();
    expect(pickLevel({ error: "x" })).toBeNull();
  });

  it("is looked for in the city with the most stops", () => {
    const tokyo: LngLat[] = [[139.7, 35.66], [139.8, 35.71], [139.75, 35.66]];
    const kyoto: LngLat[] = [[135.77, 34.97], [135.76, 35.0]];
    expect(mainCity([...kyoto, ...tokyo])).toEqual(tokyo);
    expect(mainCity(kyoto)).toEqual(kyoto);
    expect(mainCity([])).toEqual([]);
  });

  it("pads the trip's box", () => {
    expect(tripBox([[0, 0], [1, 2]])).toEqual({ w: -0.15, s: -0.3, e: 1.15, n: 2.3 });
  });
});

describe("district shapes", () => {
  const way = (...pts: LngLat[]) => ({ type: "way", role: "outer", geometry: pts.map(([lon, lat]) => ({ lat, lon })) });

  it("joins a boundary's ways into closed rings, reversed where needed, skipping inner ones", () => {
    const r = {
      type: "relation", id: 1,
      members: [way([0, 0], [1, 0]), way([1, 1], [1, 0]), way([1, 1], [0, 1], [0, 0]), { ...way([0.4, 0.4], [0.6, 0.4], [0.5, 0.6], [0.4, 0.4]), role: "inner" }, { type: "node", role: "admin_centre" }],
    };
    expect(outerRings(r)).toEqual([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]);
    expect(outerRings({ type: "relation", id: 2, members: [way([0, 0], [1, 0], [1, 1])] })).toEqual([]);
  });

  it("drops points that barely bend the outline", () => {
    const ring: LngLat[] = [[0, 0], [0.5, 0.00001], [1, 0], [1, 1], [0, 1], [0, 0]];
    expect(simplify(ring, 0.001)).toEqual([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
  });

  it("reads the named zones that have a ring, English name first", () => {
    const square = (id: number, name: string) => ({ type: "relation", id, tags: { name, "name:en": name + " (en)" }, members: [way([0, 0], [1, 0], [1, 1], [0, 1], [0, 0])] });
    const zones = zonesOf({ elements: [square(1, "A"), { ...square(2, "B"), tags: {} }, { type: "relation", id: 3, tags: { name: "C" }, members: [] }] });
    expect(zones.map((z) => z.name)).toEqual(["A (en)"]);
    expect(zones[0].rings).toHaveLength(1);
  });
});
