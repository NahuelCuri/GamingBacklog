import { describe, expect, it } from "vitest";
import {
  budget, cleanCard, cleanTrip, dayHint, fmtRange, locQuery, locStatus, mapBBox, mapPlan, money, moveCardDay, moveCardOrder,
  parseLoc, quickAddCard, seedTrips, tagSuggestions, tripCards, typeFilterOptions, matchesSearch, type TripCard,
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
});
