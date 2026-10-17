import { describe, expect, it } from "vitest";
import {
  budget, cleanCard, lookalikes, normTitle, regionFromAddress, cleanTrip, dayHint, fmtRange, locQuery, locStatus, mapBBox, mapPlan, money, moveCardDay, moveCardOrder,
  countryNames, parseLoc, pickPlace, placeSearchUrl, placesFrom, quickAddCard, regionSuggestions, placeCard, removeDay, reorderDay, seedTrips, tripArea, tagSuggestions, tripCards, typeFilterOptions, matchesSearch, type TripCard, type TripData,
} from "./model";

const seeded = () => {
  const s = seedTrips();
  // give a few cards coordinates for the map tests
  const at = (id: string, lat: number, lng: number) => (s.cards.find((c) => c.id === id)!.loc = { lat, lng });
  at("c1", 35.649, 139.789); at("c2", 35.66, 139.7); at("c3", 35.685, 139.71); at("c6", 34.967, 135.772); at("c8", 35.017, 135.671);
  return s;
};

describe("trip model (frozen from the legacy planner)", () => {
  it("seeds the example trip, priced in dollars and with coordinates", () => {
    const ours = seedTrips();
    expect(ours).toMatchSnapshot();
    expect(ours.cards.filter((c) => c.loc).map((c) => c.id)).toEqual(["c1", "c2", "c3", "c6", "c7", "c8", "c9"]);
  });

  it.each([
    "35.6764, 139.6500",
    "(35.6764;139.65)",
    "https://www.google.com/maps/place/Senso-ji/@35.7147651,139.7966553,17z",
    "https://www.google.com/maps/place/X/data=!3d35.71477!4d139.79665",
    "https://maps.google.com/?q=35.1,-58.2",
    "https://maps.google.com/?ll=35.1%2C139.2",
    "near 35.123456, 139.654321 somewhere",
    "91, 10",
    "Kyoto",
    "",
  ])("parseLoc(%j)", (raw) => {
    expect(parseLoc(raw)).toMatchSnapshot();
  });

  it("formats money, date ranges and day hints", () => {
    const out: unknown[] = [];
    for (const [n, c] of [[1234, "$"], [1234, "€"], [null, "$"], ["", "$"], [0, undefined]] as const) out.push(money(n, c));
    out.push(fmtRange("2026-04-03", "2026-04-14"));
    const t = seedTrips().trips[0];
    for (const d of [1, 2, 12]) out.push(dayHint(t, d));
    expect(out).toMatchSnapshot();
    expect(fmtRange("bad", "2026-04-14")).toBe("Dates TBD");
    expect(dayHint({ ...t, start: "" }, 1)).toBe("unscheduled");
  });

  it("moves cards between days and within a day", () => {
    const { trips, cards } = seedTrips();
    const cases: [string, number, "day" | "order"][] = [
      ["c1", 1, "day"], ["c1", -1, "day"], ["c7", -1, "day"], ["c7", 1, "day"], ["c5", 1, "day"], ["c6", 1, "day"],
      ["c2", -1, "order"], ["c1", -1, "order"], ["c1", 1, "order"], ["c9", -1, "order"], ["c12", 1, "order"],
    ];
    const out = cases.map(([id, dir, kind]) => {
      const r = kind === "day" ? moveCardDay(cards, id, dir, trips[0].dayCount!) : moveCardOrder(cards, id, dir);
      // only what moved: id, day and order of every card, plus the announcement
      return { move: `${kind} ${id} ${dir}`, message: r?.message ?? null, cards: (r?.cards ?? cards).map((c) => [c.id, c.day, c.order]) };
    });
    expect(out).toMatchSnapshot();
  });

  it("quick add turns links into research cards", () => {
    expect(["Senso-ji", "  https://example.com/x  ", "   "].map((raw) => {
      const c = quickAddCard(raw, "t1");
      return c ? { ...c, id: "x" } : null;
    })).toMatchSnapshot();
  });

  it("builds the map plan and bounding box", () => {
    const { cards } = seeded();
    const plans = (["all", "none", 1, 3, 4] as const).map((day) => {
      const p = mapPlan(tripCards(cards, "t1"), day);
      return { day, numbered: p.numbered.map((o) => [o.c.id, o.n]), ghosts: p.ghosts.map((c) => c.id) };
    });
    const loc = cards.filter((c) => c.loc) as (TripCard & { loc: { lat: number; lng: number } })[];
    expect({ plans, bbox: mapBBox(loc) }).toMatchSnapshot();
  });

  it("derives budget and filter values", () => {
    const { trips, cards } = seeded();
    const tc = tripCards(cards, "t1");
    expect({
      budget: budget(trips[0], tc),
      gridFilters: typeFilterOptions(tc).map((f) => f.label),
      typeFilters: typeFilterOptions(tc.filter((c) => c.day == null)).map((f) => f.label),
      grid: tc.filter((c) => c.type === "food" && matchesSearch(c, "kyoto")).map((c) => c.id),
    }).toMatchSnapshot();
  });

  it("suggests tags and explains the location field", () => {
    const { cards } = seeded();
    const out = [
      { tags: ["picnic"], tagInput: "" },
      { tags: [], tagInput: "BOOK" },
      { tags: [], tagInput: "", locText: "https://maps.app.goo.gl/abc" },
      { tags: [], tagInput: "", locText: "https://www.google.com/maps/search/tokyo" },
      { tags: [], tagInput: "", locText: "Kyoto" },
      { tags: [], tagInput: "", locText: "35.1, 135.2", locFound: "Kyoto, Japan" },
      { tags: [], tagInput: "", locBusy: true },
      { tags: [], tagInput: "", locErr: "none" as const },
      { tags: [], tagInput: "", locErr: "noquery" as const },
      { tags: [], tagInput: "", loc: { lat: 1, lng: 2 } },
    ].map((draft) => {
      const st = locStatus({ loc: cards[0].loc, ...draft });
      return { tags: tagSuggestions(cards, draft.tags, draft.tagInput), loc: [st.hint, st.color, st.note, st.button] };
    });
    expect(out).toMatchSnapshot();
  });
});

describe("trip model", () => {
  it("caps tag suggestions at eight, most used first", () => {
    const { cards } = seedTrips();
    const many = cards.map((c, i) => ({ ...c, tags: ["t" + (i % 10), "t" + (i % 3)] }));
    const tags = tagSuggestions(many, [], "");
    expect(tags).toHaveLength(8);
    expect(tags.slice(0, 3).sort()).toEqual(["t0", "t1", "t2"]);
  });

  it("cleans drafts for storage", () => {
    expect(cleanTrip({ id: "t9", name: "  ", budget: "" as never, dayCount: "0" as never })).toMatchObject({ name: "Untitled trip", budget: 0, dayCount: 1 });
    expect(cleanTrip({ id: "t9", name: " Rome ", budget: "1500" as never, dayCount: 5 })).toMatchObject({ name: "Rome", budget: 1500, dayCount: 5 });
    const card = seeded().cards[0];
    const edited = cleanCard({ ...card, price: "12.5" as never, tags: [" a ", "", "b"], tagInput: "x", locBusy: false, locErr: null, locFound: null });
    expect(edited).toEqual({ ...card, price: 12.5, tags: ["a", "b"] });
    expect(edited.loc).toEqual(card.loc); // untouched location field keeps the coordinates (legacy erased them)
    expect(cleanCard({ ...card, locText: "" }).loc).toBeNull();
    expect(cleanCard({ ...card, locText: "1.5, 2.5" }).loc).toEqual({ lat: 1.5, lng: 2.5 });
  });

  it("builds a name query for the location search", () => {
    expect(locQuery("https://www.google.com/maps/place/Senso-ji+Temple/data=x", "T")).toBe("Senso-ji Temple");
    expect(locQuery("https://maps.app.goo.gl/abc", "Fushimi Inari", "Kyoto")).toBe("Fushimi Inari, Kyoto");
    expect(locQuery("https://maps.app.goo.gl/abc")).toBeNull();
    expect(locQuery("Tokyo Tower")).toBe("Tokyo Tower");
  });

  it("finds cards a new one may repeat", () => {
    const cs = [
      { id: "a", title: "GINZA SIX", source: "", loc: { lat: 35.6696, lng: 139.7641 } },
      { id: "b", title: "Sensō-ji Temple", source: "https://maps.app.goo.gl/x" },
      { id: "c", title: "Tokyo Tower" },
      { id: "d", title: "Untitled link", source: "https://example.com/y" },
      { id: "e", title: "Ramen" },
    ] as TripCard[];
    expect(normTitle("  Sensō-ji Temple! ")).toBe("senso ji temple");
    expect(lookalikes(cs, { title: "Ginza  six" }).map((l) => [l.card.id, l.why])).toEqual([["a", "same title"]]);
    expect(lookalikes(cs, { title: "Untitled link", source: "https://example.com/y" }).map((l) => [l.card.id, l.why])).toEqual([["d", "same link"]]);
    expect(lookalikes(cs, { title: "Mall", loc: { lat: 35.6697, lng: 139.7642 } }).map((l) => l.why)).toEqual(["same place"]);
    expect(lookalikes(cs, { title: "Tokyo Tower observation deck" }).map((l) => [l.card.id, l.why])).toEqual([["c", "similar title"]]);
    // Short words and the card itself don't count.
    expect(lookalikes(cs, { title: "Ichiran Ramen" })).toEqual([]);
    expect(lookalikes(cs, { id: "c", title: "Tokyo Tower" })).toEqual([]);
    expect(lookalikes(cs, { title: "" })).toEqual([]);
  });

  it("names a region from a reverse lookup's address", () => {
    expect(regionFromAddress({ neighbourhood: "Ginza 4", quarter: "Ginza", city: "Chuo", country: "Japan" })).toBe("Ginza, Chuo");
    expect(regionFromAddress({ quarter: "Jerónimos", suburb: "Retiro", city: "Madrid" })).toBe("Retiro, Madrid");
    expect(regionFromAddress({ suburb: "Fushimi Ward", city: "Kyoto" })).toBe("Fushimi, Kyoto");
    expect(regionFromAddress({ town: "Hakone" })).toBe("Hakone");
    expect(regionFromAddress({ suburb: "Kyoto", city: "Kyoto" })).toBe("Kyoto");
    expect(regionFromAddress({ country: "Japan" })).toBeNull();
    expect(regionFromAddress(null)).toBeNull();
  });

  it("suggests regions already used, prefix matches first", () => {
    const cs = ["Ginza, Tokyo", "Shinjuku, Tokyo", "Shinjuku, Tokyo", "Tokyo Station", "", "Nakagyo, Kyoto"].map((region, i) => ({ id: "r" + i, region }) as TripCard);
    expect(regionSuggestions(cs, "tok")).toEqual(["Tokyo Station", "Shinjuku, Tokyo", "Ginza, Tokyo"]);
    expect(regionSuggestions(cs, "shinjuku, tokyo")).toEqual([]);
    expect(regionSuggestions(cs, "  ")).toEqual([]);
  });

  it("removing any day of any trip length renumbers the rest, with or without cards", () => {
    for (let count = 1; count <= 7; count++) {
      for (let d = 1; d <= count; d++) {
        // one card on every day and in the pool, a second one on day d, and another trip using the same day numbers
        const cards = [
          ...Array.from({ length: count }, (_, i) => ({ id: "t" + (i + 1), trip: "x", day: i + 1 })),
          { id: "twin", trip: "x", day: d }, { id: "pool", trip: "x", day: null },
          ...Array.from({ length: count }, (_, i) => ({ id: "o" + (i + 1), trip: "y", day: i + 1 })),
        ] as TripCard[];
        const data = { trips: [{ id: "x", name: "X", dayCount: count }, { id: "y", name: "Y", dayCount: count }], cards };
        const r = removeDay(data, "x", d);
        if (count === 1) {
          expect(r).toBeNull();
          continue;
        }
        expect(r!.trips.map((t) => t.dayCount)).toEqual([count - 1, count]);
        // same cards, same order; only the days move
        expect(r!.cards.map((c) => c.id)).toEqual(cards.map((c) => c.id));
        for (const [i, c] of cards.entries()) {
          const now = r!.cards[i].day;
          if (c.trip === "y" || c.day == null) expect(now).toBe(c.day);
          else if (c.day === d) expect(now).toBeNull();
          else expect(now).toBe(c.day < d ? c.day : c.day - 1);
        }
        // every card left on a day lands inside the new range
        expect(r!.cards.filter((c) => c.trip === "x").every((c) => c.day == null || (c.day >= 1 && c.day <= count - 1))).toBe(true);
      }
    }
  });

  it("removing days one after another keeps the cards on the days they were on", () => {
    // days 1..4 hold a, b, c, d; take out day 3, then day 1: b and d are what's left of days 2 and 4
    let data: TripData = { trips: [{ id: "x", name: "X", dayCount: 4 }], cards: ["a", "b", "c", "d"].map((id, i) => ({ id, trip: "x", day: i + 1 })) as TripCard[] };
    for (const d of [3, 1]) {
      const r = removeDay(data, "x", d)!;
      data = { trips: r.trips, cards: r.cards };
    }
    expect(data.trips[0].dayCount).toBe(2);
    expect(data.cards.map((c) => [c.id, c.day])).toEqual([["a", null], ["b", 1], ["c", null], ["d", 2]]);
  });

  it("moving a day shifts the days between it and its new place, and leaves the rest alone", () => {
    for (let count = 1; count <= 6; count++) {
      for (let from = 1; from <= count; from++) {
        for (let to = 1; to <= count; to++) {
          // day n holds card "dn"; the pool and another trip use the same numbers
          const cards = [
            ...Array.from({ length: count }, (_, i) => ({ id: "d" + (i + 1), trip: "x", day: i + 1 })),
            { id: "pool", trip: "x", day: null },
            ...Array.from({ length: count }, (_, i) => ({ id: "o" + (i + 1), trip: "y", day: i + 1 })),
          ] as TripCard[];
          const r = reorderDay(cards, "x", from, to, count);
          if (from === to) {
            expect(r).toBeNull();
            continue;
          }
          // read the days back in order: the moved day's plan sits at `to`, the others keep their order
          const order = Array.from({ length: count }, (_, i) => r!.find((c) => c.trip === "x" && c.day === i + 1)!.id);
          const expected = Array.from({ length: count }, (_, i) => "d" + (i + 1)).filter((id) => id !== "d" + from);
          expected.splice(to - 1, 0, "d" + from);
          expect(order).toEqual(expected);
          expect(r!.filter((c) => c.trip === "y" || c.day == null)).toEqual(cards.filter((c) => c.trip === "y" || c.day == null));
        }
      }
    }
    expect(reorderDay([], "x", 0, 2, 3)).toBeNull();
    expect(reorderDay([], "x", 1, 4, 3)).toBeNull();
  });

  it("places a dropped card at the spot it was dropped on, among that day's cards", () => {
    // day 1: a, b, c; day 2: x; z is another trip's card on day 1, and p is in the pool
    const cards = [
      { id: "a", trip: "t", day: 1 }, { id: "x", trip: "t", day: 2 }, { id: "b", trip: "t", day: 1 },
      { id: "z", trip: "o", day: 1 }, { id: "c", trip: "t", day: 1 }, { id: "p", trip: "t", day: null },
    ] as TripCard[];
    const day = (cs: TripCard[], d: number) => cs.filter((c) => c.trip === "t" && c.day === d).map((c) => c.id);
    expect(day(placeCard(cards, "p", 1, 0), 1)).toEqual(["p", "a", "b", "c"]);
    expect(day(placeCard(cards, "p", 1, 2), 1)).toEqual(["a", "b", "p", "c"]);
    expect(day(placeCard(cards, "p", 1, 9), 1)).toEqual(["a", "b", "c", "p"]);
    expect(day(placeCard(cards, "x", 1, 1), 1)).toEqual(["a", "x", "b", "c"]);
    // within its own day: the index counts the day's other cards
    expect(day(placeCard(cards, "c", 1, 0), 1)).toEqual(["c", "a", "b"]);
    expect(day(placeCard(cards, "a", 1, 1), 1)).toEqual(["b", "a", "c"]);
    // onto an empty day, and nothing else moves
    const r = placeCard(cards, "a", 3, 0);
    expect(day(r, 3)).toEqual(["a"]);
    expect(r.filter((c) => c.id !== "a")).toEqual(cards.filter((c) => c.id !== "a"));
  });

  it("refuses days that aren't there", () => {
    const data = { trips: [{ id: "x", name: "X", dayCount: 3 }], cards: [] as TripCard[] };
    expect(removeDay(data, "x", 0)).toBeNull();
    expect(removeDay(data, "x", 4)).toBeNull();
    expect(removeDay(data, "nope", 1)).toBeNull();
  });

  it("removes a day, sends its cards to the pool and closes the gap", () => {
    const base = seedTrips();
    const t = base.trips[0];
    const data = {
      trips: base.trips.map((x) => (x.id === t.id ? { ...x, dayCount: 3 } : x)),
      cards: [
        { id: "a", trip: t.id, day: 1 }, { id: "b", trip: t.id, day: 2 }, { id: "c", trip: t.id, day: 3 }, { id: "p", trip: t.id, day: null },
        { id: "o", trip: "other", day: 2 },
      ] as TripCard[],
    };
    const r = removeDay(data, t.id, 2)!;
    expect(r.trips.find((x) => x.id === t.id)!.dayCount).toBe(2);
    expect(r.cards.map((c) => [c.id, c.day])).toEqual([["a", 1], ["b", null], ["c", 2], ["p", null], ["o", 2]]);
    expect(removeDay({ ...data, trips: data.trips.map((x) => ({ ...x, dayCount: 1 })) }, t.id, 1)).toBeNull();
  });
});

describe("place search", () => {
  const kyoto = { lat: 35.039, lng: 135.729, name: "Kinkaku-ji, Kyoto, Japan", country: "jp" };
  const nara = { lat: 34.689, lng: 135.84, name: "Kinkaku, Nara, Japan", country: "jp" };
  const nyc = { lat: 40.73, lng: -73.99, name: "Kinkaku, Manhattan, New York, United States", country: "us" };
  const stops = [{ lat: 35.0, lng: 135.77 }, { lat: 35.68, lng: 139.7 }];

  it("reads search results, dropping malformed ones", () => {
    expect(placesFrom([{ lat: "35.1", lon: "135.2", display_name: "X, Japan", address: { country_code: "JP" } }, { lat: "nope" }, null])).toEqual([{ lat: 35.1, lng: 135.2, name: "X, Japan", country: "jp" }]);
    expect(placesFrom({ error: "x" })).toEqual([]);
    const twice = { lat: "40.7", lon: "-74", display_name: "Chelsea Market, New York" };
    expect(placesFrom([twice, { ...twice, lat: "40.71" }])).toHaveLength(1);
  });

  it("sizes the trip's area from its other located cards", () => {
    const cards = seeded().cards;
    const a = tripArea(cards)!;
    expect(a.w).toBeLessThan(135.671);
    expect(a.e).toBeGreaterThan(139.789);
    expect(a.e - a.w).toBeLessThan(15);
    // a card's own pin doesn't count, nor do cards without one
    expect(tripArea([{ ...cards[0], loc: { lat: 1, lng: 1 } }], cards[0].id)).toBeNull();
    expect(tripArea(seedTrips().cards.map((c) => ({ ...c, loc: null })))).toBeNull();
  });

  it("restricts the search to the area when there is one", () => {
    expect(placeSearchUrl("Kinkaku-ji", { area: { s: 33, n: 37, w: 134, e: 141 } })).toContain("&viewbox=134,37,141,33&bounded=1&");
    expect(placeSearchUrl("Kinkaku-ji")).not.toContain("viewbox");
    // countries win over an area: a hard lock
    expect(placeSearchUrl("Kinkaku-ji", { countries: ["jp", "kr"], area: { s: 33, n: 37, w: 134, e: 141 } })).toMatch(/&countrycodes=jp,kr&q=/);
  });

  it("names countries for the editor's notes", () => {
    expect(countryNames(["jp"])).toBe("Japan");
    expect(countryNames(["fr", "es", "it"])).toBe("France, Spain and Italy");
  });

  it("picks a match inside the trip's area, nearest the other stops first", () => {
    const area = tripArea(seeded().cards);
    expect(pickPlace([nara, kyoto], [], stops, area)).toMatchObject({ pick: kyoto, far: false });
  });

  it("never picks a match far from the trip on its own", () => {
    const area = tripArea(seeded().cards);
    expect(pickPlace([], [nyc], stops, area)).toEqual({ pick: null, choices: [nyc], far: true });
  });

  it("without an area, picks a lone answer or one country's, and asks across countries", () => {
    expect(pickPlace([], [nyc], [], null).pick).toBe(nyc);
    expect(pickPlace([], [kyoto, nara], [], null).pick).toBe(kyoto);
    expect(pickPlace([], [kyoto, nyc], [], null)).toMatchObject({ pick: null, far: false });
    expect(pickPlace([], [], [], null)).toEqual({ pick: null, choices: [], far: false });
  });
});
