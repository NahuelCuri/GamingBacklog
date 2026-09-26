import { describe, expect, it } from "vitest";
import { legacyPlanner, plain } from "@/tests/legacy-trips";
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

describe("trip model vs legacy", () => {
  it("seeds the same example trip", () => {
    const L = legacyPlanner();
    const s = plain(L.seed());
    expect(seedTrips()).toEqual({ trips: s.trips, cards: s.cards });
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
    expect(parseLoc(raw)).toEqual(plain(legacyPlanner().parseLoc(raw)));
  });

  it("formats money, date ranges and day hints", () => {
    const L = legacyPlanner();
    for (const [n, c] of [[1234, "$"], [1234, "€"], [null, "$"], ["", "$"], [0, undefined]] as const) expect(money(n, c)).toBe(L.money(n, c));
    expect(fmtRange("2026-04-03", "2026-04-14")).toBe(L.fmtRange("2026-04-03", "2026-04-14"));
    expect(fmtRange("bad", "2026-04-14")).toBe("Dates TBD");
    const t = seedTrips().trips[0];
    for (const d of [1, 2, 12]) expect(dayHint(t, d)).toBe(L.dayHint(t, d));
    expect(dayHint({ ...t, start: "" }, 1)).toBe("unscheduled");
  });

  it("moves cards between days and within a day like legacy", () => {
    const { trips, cards } = seedTrips();
    const cases: [string, number, "day" | "order"][] = [
      ["c1", 1, "day"], ["c1", -1, "day"], ["c7", -1, "day"], ["c7", 1, "day"], ["c5", 1, "day"], ["c6", 1, "day"],
      ["c2", -1, "order"], ["c1", -1, "order"], ["c1", 1, "order"], ["c9", -1, "order"], ["c12", 1, "order"],
    ];
    for (const [id, dir, kind] of cases) {
      const L = legacyPlanner({ trips, cards, tripId: "t1" });
      if (kind === "day") L.moveCardDay(id, dir); else L.moveCardOrder(id, dir);
      const ours = kind === "day" ? moveCardDay(cards, id, dir, trips[0].dayCount!) : moveCardOrder(cards, id, dir);
      expect(ours?.cards ?? cards, `${kind} ${id} ${dir}`).toEqual(plain(L.state.cards));
      if (ours) expect(ours.message).toBe(L.state.liveMsg);
    }
  });

  it("quick add turns links into research cards", () => {
    for (const raw of ["Senso-ji", "  https://example.com/x  ", "   "]) {
      const L = legacyPlanner({ ...seedTrips(), tripId: "t1", quickText: raw });
      L.onQuickKey({ key: "Enter" });
      const legacyNew = plain<TripCard[]>(L.state.cards).slice(12);
      const ours = quickAddCard(raw, "t1");
      expect(ours ? [{ ...ours, id: "x" }] : []).toEqual(legacyNew.map((c) => ({ ...c, id: "x" })));
    }
  });

  it("builds the same map plan and bounding box", () => {
    const { trips, cards } = seeded();
    for (const day of ["all", "none", 1, 3, 4] as const) {
      const L = legacyPlanner({ trips, cards, tripId: "t1", mapDay: day === "all" ? null : day });
      const lp = L.mapPlan();
      const ours = mapPlan(tripCards(cards, "t1"), day);
      expect(ours.numbered.map((o) => [o.c.id, o.n])).toEqual(lp.numbered.map((o: { c: TripCard; n: number }) => [o.c.id, o.n]));
      expect(ours.ghosts.map((c) => c.id)).toEqual(lp.ghosts.map((c: TripCard) => c.id));
    }
    const L = legacyPlanner({ trips, cards, tripId: "t1" });
    const loc = cards.filter((c) => c.loc) as (TripCard & { loc: { lat: number; lng: number } })[];
    expect(mapBBox(loc)).toEqual(plain(L._mapBBox(loc)));
  });

  it("derives home and board values like renderVals", () => {
    const { trips, cards } = seeded();
    const L = legacyPlanner({ trips, cards, tripId: "t1", view: "board", poolFilter: "food", searchText: "kyoto" });
    const v = L.renderVals();
    const t = trips[0];
    const b = budget(t, tripCards(cards, "t1"));
    expect(v.trips[0].budgetLabel).toBe(`${b.spentDisp} of ${b.budgetDisp}`);
    expect(v.trips[0].budgetPct).toBe(b.pct);
    expect(v.trip.budgetColor).toBe(b.color);
    expect(v.gridFilters.map((f: { label: string }) => f.label)).toEqual(typeFilterOptions(tripCards(cards, "t1")).map((f) => f.label));
    expect(v.typeFilters.map((f: { label: string }) => f.label)).toEqual(typeFilterOptions(tripCards(cards, "t1").filter((c) => c.day == null)).map((f) => f.label));
    const grid = tripCards(cards, "t1").filter((c) => c.type === "food" && matchesSearch(c, "kyoto"));
    expect(v.gridCards.map((c: { id: string }) => c.id)).toEqual(grid.map((c) => c.id));
  });

  it("suggests tags and explains the location field like the editor", () => {
    const { trips, cards } = seeded();
    for (const draft of [
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
    ]) {
      const L = legacyPlanner({ trips, cards, tripId: "t1", view: "board", modal: { ...cards[0], ...draft } });
      const m = L.renderVals().m;
      expect(tagSuggestions(cards, draft.tags, draft.tagInput)).toEqual(m.tagSuggest.map((t: { tag: string }) => t.tag));
      const st = locStatus({ loc: cards[0].loc, ...draft });
      expect([st.hint, st.color, st.note, st.button]).toEqual([m.locHint, m.locColor, m.locNote, m.locBtn]);
    }
  });
});

describe("trip model", () => {
  it("caps tag suggestions at eight, most used first (legacy)", () => {
    const { trips, cards } = seedTrips();
    const many = cards.map((c, i) => ({ ...c, tags: ["t" + (i % 10), "t" + (i % 3)] }));
    const L = legacyPlanner({ trips, cards: many, tripId: "t1", view: "board", modal: { ...many[0], tags: [], tagInput: "" } });
    const legacy = L.renderVals().m.tagSuggest.map((t: { tag: string }) => t.tag);
    expect(legacy).toHaveLength(8);
    expect(tagSuggestions(many, [], "")).toEqual(legacy);
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
