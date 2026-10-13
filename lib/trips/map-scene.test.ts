import { describe, expect, it } from "vitest";
import { boxOf, fitZoom, framePoints, frameKey, mapScene, minZoomFor } from "./map-scene";
import type { TripCard } from "./model";

const card = (id: string, day: number | null, lng: number, lat: number, extra: Partial<TripCard> = {}) =>
  ({ id, trip: "t", title: id.toUpperCase(), type: "food", day, loc: { lat, lng }, ...extra }) as TripCard;

const cards = [
  card("a", 1, 139.7, 35.6, { startTime: "09:00" }),
  card("b", 1, 139.71, 35.61),
  card("c", 2, 139.8, 35.7),
  card("d", 2, 139.81, 35.71),
  card("u", null, 139.9, 35.8, { duration: "2h" }),
  { id: "x", trip: "t", title: "no place", type: "food", day: 1, loc: null } as TripCard,
];

describe("mapScene", () => {
  it("numbers stops per day, adds unscheduled ghosts, and routes each day separately", () => {
    const s = mapScene(cards, "all");
    expect(s.pins.map((p) => [p.id, p.n])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 1],
      ["d", 2],
      ["u", 0],
    ]);
    expect(s.route).toEqual([
      [
        [139.7, 35.6],
        [139.71, 35.61],
      ],
      [
        [139.8, 35.7],
        [139.81, 35.71],
      ],
    ]);
    expect(s.pins[0].tip).toContain("Day 1");
    expect(s.pins[0].meta).toContain("09:00");
    expect(s.pins[4].tip).toContain("Unscheduled");
  });

  it("shows one day's stops without ghosts, and frames just those", () => {
    const s = mapScene(cards, 2);
    expect(s.pins.map((p) => p.id)).toEqual(["c", "d"]);
    expect(framePoints(s)).toEqual([
      [139.8, 35.7],
      [139.81, 35.71],
    ]);
  });

  it("frames the ghosts when no stop is numbered", () => {
    const s = mapScene(cards, "none");
    expect(s.route).toEqual([]);
    expect(framePoints(s)).toEqual([[139.9, 35.8]]);
  });

  it("keys the frame on positions, not on other edits", () => {
    const renamed = cards.map((c) => (c.id === "a" ? { ...c, title: "renamed" } : c));
    const moved = cards.map((c) => (c.id === "a" ? { ...c, loc: { lat: 35.5, lng: 139.7 } } : c));
    const key = (cs: TripCard[]) => frameKey(framePoints(mapScene(cs, "all")));
    expect(key(renamed)).toBe(key(cards));
    expect(key(moved)).not.toBe(key(cards));
  });
});

describe("framing maths", () => {
  const opts = { maxZoom: 15, outPast: 2, floor: 10 };

  it("gives a lone stop a real box, so it can be framed", () => {
    const b = boxOf([[139.79, 35.71]]);
    expect(b.e - b.w).toBeCloseTo(0.01);
    expect(Number.isFinite(fitZoom(b, 1000, 600, 70))).toBe(true);
  });

  it("lets a one-stop trip zoom out to city level, not the world", () => {
    expect(minZoomFor([[139.79, 35.71]], 1000, 600, 70, opts)).toBe(10);
  });

  it("lets a Tokyo–Osaka trip zoom out a little past the whole route", () => {
    const z = minZoomFor([[139.79, 35.71], [135.5, 34.69]], 1000, 600, 70, opts);
    expect(z).toBeGreaterThan(3);
    expect(z).toBeLessThan(6);
  });

  it("still gives a number when the map has no size yet", () => {
    expect(Number.isFinite(minZoomFor([[139.79, 35.71]], 0, 0, 70, opts))).toBe(true);
  });
});
