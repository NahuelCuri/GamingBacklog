import { describe, expect, it } from "vitest";
import { seedTrips } from "./model";
import { buildTripExport, tripExportFileName } from "./transfer";

describe("trip export", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("names the file after the trip, without accents or symbols", () => {
    expect(tripExportFileName("Japón 2026!", now)).toBe("backlog-trip-japon-2026-2026-10-18.json");
    expect(tripExportFileName("  ", now)).toBe("backlog-trip-trip-2026-10-18.json");
  });

  it("writes the trip and only its cards, as TripData", () => {
    const data = seedTrips();
    const other = { ...data.cards[0], id: "x1", trip: "other" };
    const id = data.trips[0].id;
    const file = buildTripExport({ trips: data.trips, cards: [...data.cards, other] }, id, now)!;
    const out = JSON.parse(file.json);
    expect(out.trips).toEqual([data.trips[0]]);
    expect(out.cards).toEqual(data.cards.filter((c) => c.trip === id));
  });

  it("returns null for an unknown trip", () => {
    expect(buildTripExport(seedTrips(), "nope", now)).toBeNull();
  });
});
