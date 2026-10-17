// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedTrips, type TripCard } from "./model";
import { countryAt, searchPlaces, tripCountries } from "./places";

const answer = (body: unknown) => vi.fn(async (_url: string) => ({ json: async () => body }));

afterEach(() => localStorage.clear());

describe("trip countries", () => {
  it("asks once per area, and remembers", async () => {
    const f = answer({ address: { country_code: "JP" } });
    expect(await countryAt({ lat: 35.66, lng: 139.7 }, f)).toBe("jp");
    expect(await countryAt({ lat: 35.68, lng: 139.71 }, f)).toBe("jp");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toContain("zoom=3");
  });

  it("uses the countries cards already know, and looks up the rest", async () => {
    const cards = seedTrips().cards;
    const f = answer({ address: { country_code: "jp" } });
    // a card that knows it's in Korea, and the seed's located Japanese stops
    const withKorea: TripCard[] = [...cards, { ...cards[0], id: "k", country: "kr", loc: { lat: 37.57, lng: 126.98 } }];
    expect(await tripCountries(withKorea, undefined, f)).toEqual(["jp", "kr"]);
    // a few lookups at most, never for the card being edited
    expect(f.mock.calls.length).toBeLessThanOrEqual(5);
    expect(await tripCountries(cards.map((c) => ({ ...c, loc: null })), undefined, f)).toEqual([]);
  });

  it("searches without the lock when the lookups fail", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await tripCountries(seedTrips().cards, undefined, f)).toEqual([]);
  });

  it("searches locked to the countries", async () => {
    const f = answer([{ lat: "35.03", lon: "135.72", display_name: "Kinkaku-ji, Kyoto, Japan", address: { country_code: "jp" } }]);
    expect(await searchPlaces("Kinkaku-ji", { countries: ["jp"] }, f)).toHaveLength(1);
    expect(f.mock.calls[0][0]).toContain("countrycodes=jp");
  });
});
