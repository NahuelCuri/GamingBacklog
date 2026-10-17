// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { byOrder, seedTrips } from "@/lib/trips/model";
import { memoryTripStore } from "@/lib/trips/store";
import { TripPlanner } from "./TripPlanner";

vi.mock("@/components/shell/ShellProvider", () => ({ useShell: () => ({ libs: ["games"], navigate: vi.fn(), openSettings: vi.fn() }) }));
// jsdom has no WebGL: stand in for the MapLibre canvas with one element per pin.
vi.mock("./TripMapCanvas", () => ({
  default: ({ scene, frameKey }: { scene: { pins: { id: string; n: number }[] }; frameKey: string }) => (
    <div data-testid="trip-map" data-frame={frameKey}>
      {scene.pins.map((p) => (
        <span key={p.id} className="pin" data-n={p.n} />
      ))}
    </div>
  ),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "me@example.com" }, signOut: vi.fn() }) }));

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.map(String).join(" ")));
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("fetch", async () => ({ ok: false, status: 503, json: async () => ({}) }));
  history.replaceState(null, "", "/trips/");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function setup(data = seedTrips()) {
  const store = memoryTripStore(data);
  render(<TripPlanner store={store} />);
  await screen.findByText("Where to next?");
  return store;
}

const openJapan = () => fireEvent.click(screen.getByRole("button", { name: "Open Japan · Cherry Season" }));
const dialog = () => screen.getByRole("dialog");

describe("TripPlanner", () => {
  it("lists trips and opens one; the URL follows", async () => {
    await setup();
    expect(screen.getByText("1 trip")).toBeTruthy();
    expect(screen.getByText("$125 of $4,200")).toBeTruthy();
    openJapan();
    expect(screen.getByRole("heading", { name: "Japan · Cherry Season" })).toBeTruthy();
    expect(location.search).toBe("?trip=t1&tab=cards");
    expect(screen.getAllByRole("button", { name: / — open$/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    expect(location.search).toBe("?trip=t1&tab=itinerary");
    fireEvent.click(screen.getByRole("button", { name: "Back to all trips" }));
    expect(location.search).toBe("");
    expect(errors).toEqual([]);
  });

  it("filters and searches cards", async () => {
    await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    expect(screen.getAllByRole("button", { name: / — open$/ })).toHaveLength(3);
    fireEvent.change(screen.getByRole("textbox", { name: "Search cards" }), { target: { value: "kyoto" } });
    expect(screen.getAllByRole("button", { name: / — open$/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["Nishiki Market crawl — open"]);
  });

  it("creates, views, edits and deletes a card with undo", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "New card" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Card title" }), { target: { value: "Tsukiji breakfast" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Food" }));
    // Region offers the ones already used; arrows + Enter pick, Escape closes just the list.
    const region = within(dialog()).getByRole("combobox", { name: "Region or place" }) as HTMLInputElement;
    fireEvent.change(region, { target: { value: "shin" } });
    expect(within(dialog()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Shinjuku, Tokyo"]);
    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: "Enter" });
    expect(region.value).toBe("Shinjuku, Tokyo");
    expect(within(dialog()).queryByRole("option")).toBeNull();
    fireEvent.change(region, { target: { value: "Fushimi" } });
    expect(within(dialog()).getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(region, { key: "Escape" });
    expect(within(dialog()).queryByRole("option")).toBeNull();
    expect(dialog()).toBeTruthy();
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Add a tag" }), { target: { value: "early" } });
    fireEvent.keyDown(within(dialog()).getByRole("textbox", { name: "Add a tag" }), { key: "Enter" });
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Price" }), { target: { value: "30" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(store.data.cards.find((c) => c.title === "Tsukiji breakfast")).toMatchObject({ type: "food", tags: ["early"], price: 30, trip: "t1" }));

    fireEvent.click(screen.getByRole("button", { name: "Tsukiji breakfast — open" }));
    expect(within(dialog()).getByText("$30")).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Edit" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Tap again to delete" }));
    await waitFor(() => expect(store.data.cards.some((c) => c.title === "Tsukiji breakfast")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(store.data.cards.some((c) => c.title === "Tsukiji breakfast")).toBe(true));
    expect(errors).toEqual([]);
  });

  it("editing a located card keeps its coordinates", async () => {
    const data = seedTrips();
    data.cards[0].loc = { lat: 35.649, lng: 139.789 };
    const store = await setup(data);
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "Edit teamLab Planets" }));
    expect((within(dialog()).getByRole("textbox", { name: /^Location/ }) as HTMLInputElement).value).toBe("35.64900, 139.78900");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Card title" }), { target: { value: "teamLab" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(store.data.cards[0]).toMatchObject({ title: "teamLab", loc: { lat: 35.649, lng: 139.789 } }));
  });

  it("without known countries, searches near the trip first and lets you pick a far match", async () => {
    const urls: string[] = [];
    const place = (lat: string, lon: string, name: string, cc: string) => ({ lat, lon, display_name: name, address: { country_code: cc } });
    let near: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const body = url.includes("/reverse") ? {} : url.includes("bounded=1") ? near : [place("40.73", "-73.99", "Kinkaku, Manhattan, New York, United States", "us")];
      return { ok: true, json: async () => body };
    });
    await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "New card" }));
    const locField = () => within(dialog()).getByRole("textbox", { name: /^Location/ }) as HTMLInputElement;

    // Nothing near the trip: the New York match is offered, not taken.
    fireEvent.change(locField(), { target: { value: "Kinkaku" } });
    fireEvent.blur(locField());
    await within(dialog()).findByText(/Nothing by that name near the trip's other stops/);
    expect(urls.find((u) => u.includes("/search"))).toContain("bounded=1");
    expect(locField().value).toBe("Kinkaku");
    fireEvent.click(within(dialog()).getByRole("button", { name: /Manhattan/ }));
    expect(locField().value).toBe("40.73000, -73.99000");

    // A match near the trip is taken right away, and Enter searches too.
    near = [place("35.039", "135.729", "Kinkaku-ji, Kyoto, Japan", "jp")];
    fireEvent.change(locField(), { target: { value: "Kinkaku-ji" } });
    fireEvent.keyDown(locField(), { key: "Enter" });
    await waitFor(() => expect(locField().value).toBe("35.03900, 135.72900"));
    expect(within(dialog()).getByText(/Found: Kinkaku-ji, Kyoto, Japan/)).toBeTruthy();
    // leaving the field after that doesn't search again
    const n = urls.filter((u) => u.includes("/search")).length;
    fireEvent.blur(locField());
    expect(urls.filter((u) => u.includes("/search")).length).toBe(n);
    expect(errors).toEqual([]);
  });

  it("locks place searches to the trip's countries, with a way out", async () => {
    const urls: string[] = [];
    const nyc = { lat: "40.74", lon: "-74.0", display_name: "Chelsea Market, Manhattan, New York, United States", address: { country_code: "us" } };
    const kyoto = { lat: "35.039", lon: "135.729", display_name: "Kinkaku-ji, Kyoto, Japan", address: { country_code: "jp" } };
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const body = url.includes("zoom=3") ? { address: { country_code: "jp" } } : url.includes("/reverse") ? {} : url.includes("countrycodes=jp") ? (url.includes("Kinkaku") ? [kyoto] : []) : [nyc];
      return { ok: true, json: async () => body };
    });
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "New card" }));
    const locField = () => within(dialog()).getByRole("textbox", { name: /^Location/ }) as HTMLInputElement;

    fireEvent.change(locField(), { target: { value: "Chelsea Market" } });
    fireEvent.keyDown(locField(), { key: "Enter" });
    await within(dialog()).findByText(/Nothing by that name in Japan/);
    expect(urls.some((u) => u.includes("/search") && !u.includes("countrycodes"))).toBe(false);
    expect(locField().value).toBe("Chelsea Market");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Search everywhere" }));
    fireEvent.click(await within(dialog()).findByRole("button", { name: /Manhattan/ }));
    expect(locField().value).toBe("40.74000, -74.00000");

    fireEvent.change(locField(), { target: { value: "Kinkaku-ji" } });
    fireEvent.keyDown(locField(), { key: "Enter" });
    await waitFor(() => expect(locField().value).toBe("35.03900, 135.72900"));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Card title" }), { target: { value: "Golden Pavilion" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    // the saved card keeps its country, so the next search needn't look it up
    await waitFor(() => expect(store.data.cards.find((c) => c.title === "Golden Pavilion")).toMatchObject({ country: "jp", loc: { lat: 35.039, lng: 135.729 } }));
    expect(errors).toEqual([]);
  });

  it("schedules with the keyboard and quick-adds to the pool", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    const nishiki = screen.getByRole("button", { name: /^Nishiki Market crawl — in the pool/ });
    fireEvent.keyDown(nishiki, { key: "ArrowRight" });
    await waitFor(() => expect(store.data.cards.find((c) => c.id === "c7")?.day).toBe(1));
    expect(screen.getByText("Nishiki Market crawl moved to day 1")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: /^Nishiki Market crawl — day 1/ }), { key: "ArrowUp" });
    await waitFor(() => expect(byOrder(store.data.cards).filter((c) => c.day === 1).map((c) => c.id)).toEqual(["c1", "c7", "c2"]));

    const quick = screen.getByRole("textbox", { name: "Quick add a card" });
    fireEvent.change(quick, { target: { value: "https://example.com/onsen" } });
    fireEvent.keyDown(quick, { key: "Enter" });
    await waitFor(() => expect(store.data.cards.at(-1)).toMatchObject({ title: "Untitled link", type: "research", source: "https://example.com/onsen", day: null }));

    fireEvent.click(screen.getByRole("button", { name: "Add day" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(5));
    expect(errors).toEqual([]);
  });

  it("moves a card to any day from its menu, without dragging", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move Nishiki Market crawl" }));
    const sheet = screen.getByRole("dialog", { name: "Move Nishiki Market crawl" });
    expect(within(sheet).getByRole("button", { name: /^Pool/ }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Day 3/ }));
    await waitFor(() => expect(store.data.cards.find((c) => c.id === "c7")?.day).toBe(3));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Nishiki Market crawl moved to day 3")).toBeTruthy();
    expect(errors).toEqual([]);
  });

  it("removing a day can be undone", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    const before = store.data.cards.map((c) => ({ id: c.id, day: c.day ?? null }));
    fireEvent.click(screen.getByRole("button", { name: "Remove day 1" }));
    await screen.findByText("Day 1 removed · 2 cards back in the pool");
    expect(store.data.trips[0].dayCount).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(4));
    expect(store.data.cards.map((c) => ({ id: c.id, day: c.day ?? null }))).toEqual(before);
  });

  it("offers the days the trip's dates cover", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    expect(screen.getByText(/Your dates cover 12 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add the other 8" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(12));
    expect(screen.queryByText(/Your dates cover/)).toBeNull();
  });

  it("says so when a linked trip isn't there", async () => {
    history.replaceState(null, "", "/trips/?trip=nope&tab=cards");
    render(<TripPlanner store={memoryTripStore(seedTrips())} />);
    await screen.findByText("This trip isn’t here");
    fireEvent.click(screen.getByRole("button", { name: "See all trips" }));
    await screen.findByText("Where to next?");
  });

  it("tabs move with the arrow keys", async () => {
    await setup();
    openJapan();
    const cardsTab = screen.getByRole("tab", { name: /^Cards/ });
    expect(cardsTab.getAttribute("aria-controls")).toBe("tp-main");
    fireEvent.keyDown(cardsTab, { key: "ArrowRight" });
    expect(location.search).toBe("?trip=t1&tab=itinerary");
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Itinerary/ }), { key: "End" });
    expect(location.search).toBe("?trip=t1&tab=map");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("tp-tab-map");
  });

  const laneTitles = () => screen.getAllByRole("heading", { level: 3, name: /^Day \d+$/ }).map((e) => e.textContent);

  it("removes a day: its cards go to the pool and the later days move up", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    expect(laneTitles()).toEqual(["Day 1", "Day 2", "Day 3", "Day 4"]);
    const before = store.data.cards.map((c) => ({ id: c.id, day: c.day ?? null }));
    fireEvent.click(screen.getByRole("button", { name: "Remove day 3" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(3));
    expect(laneTitles()).toEqual(["Day 1", "Day 2", "Day 3"]);
    expect(store.data.cards.map((c) => ({ id: c.id, day: c.day ?? null }))).toEqual(before.map(({ id, day }) => ({ id, day: day === 3 ? null : day != null && day > 3 ? day - 1 : day })));
    // every lane is still there to use: no leftover remove-day state hides one
    expect(screen.getAllByRole("button", { name: /^Remove day \d$/ })).toHaveLength(3);
    expect(errors).toEqual([]);
  });

  it("removing a day leaves the other lanes in place: same elements, same cards, new numbers", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    const lane = (d: number) => document.querySelector<HTMLElement>(`[data-day="${d}"]`)!;
    const [one, two, four] = [lane(1), lane(2), lane(4)];
    const fourCards = [...four.querySelectorAll("[data-flip]")];
    fireEvent.click(screen.getByRole("button", { name: "Remove day 3" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(3));
    expect([lane(1), lane(2), lane(3)]).toEqual([one, two, four]);
    expect(lane(3).textContent).toContain("Day 3");
    expect([...lane(3).querySelectorAll("[data-flip]")]).toEqual(fourCards);
    expect(document.querySelector('[data-day="4"]')).toBeNull();
  });

  it("can remove days down to one, from the first, the last or the middle", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    for (const [d, left] of [[1, 3], [3, 2], [2, 1]] as const) {
      fireEvent.click(screen.getByRole("button", { name: "Remove day " + d }));
      await waitFor(() => expect(store.data.trips[0].dayCount).toBe(left));
      expect(laneTitles()).toEqual(Array.from({ length: left }, (_, i) => "Day " + (i + 1)));
    }
    // the last day can't be removed
    expect(screen.queryByRole("button", { name: /^Remove day/ })).toBeNull();
    expect(errors).toEqual([]);
  });

  it("the dissolving lane is let go once the days change, so the next day isn't left hidden", async () => {
    const cancel = vi.fn();
    const finishers: (() => void)[] = [];
    Element.prototype.animate = vi.fn(function () {
      const a = { cancel, onfinish: null as null | (() => void) };
      finishers.push(() => a.onfinish?.());
      return a;
    }) as never;
    try {
      const store = await setup();
      openJapan();
      fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
      const lane = () => document.querySelector<HTMLElement>('[data-day="3"]')!;
      fireEvent.click(screen.getByRole("button", { name: "Remove day 3" }));
      const fade = finishers.length;
      expect(fade).toBeGreaterThan(0);
      // while it dissolves nothing has changed yet, and the lane ignores the pointer
      expect(store.data.trips[0].dayCount).toBe(4);
      expect(lane().style.pointerEvents).toBe("none");
      act(() => finishers[fade - 1]());
      await waitFor(() => expect(store.data.trips[0].dayCount).toBe(3));
      expect(cancel).toHaveBeenCalled();
      expect(lane().style.pointerEvents).toBe("");
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  });

  it("warns about a card that repeats one already in the trip", async () => {
    const store = await setup();
    openJapan();
    const before = store.data.cards.length;
    // Quick add: a repeated title holds the first Enter back; the second adds it anyway.
    fireEvent.click(screen.getByRole("tab", { name: /^Itinerary/ }));
    const quick = screen.getByRole("textbox", { name: "Quick add a card" });
    fireEvent.change(quick, { target: { value: "golden gai bar crawl" } });
    expect(screen.getByRole("status").textContent).toContain("Golden Gai bar crawlsame title · Day 2");
    fireEvent.keyDown(quick, { key: "Enter" });
    expect(screen.getByText("Press Enter again to add it anyway.")).toBeTruthy();
    expect(store.data.cards).toHaveLength(before);
    fireEvent.keyDown(quick, { key: "Enter" });
    await waitFor(() => expect(store.data.cards).toHaveLength(before + 1));

    // New card: the note offers the existing card instead, dropping the draft.
    fireEvent.click(screen.getByRole("tab", { name: /^Cards/ }));
    fireEvent.click(screen.getByRole("button", { name: "New card" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Card title" }), { target: { value: "Fushimi Inari at dawn" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "edit that one" }));
    expect((within(dialog()).getByRole("textbox", { name: "Card title" }) as HTMLInputElement).value).toBe("Fushimi Inari at dawn");
    expect(within(dialog()).getByText("Edit card")).toBeTruthy();
    expect(within(dialog()).queryByRole("status")).toBeNull();
    expect(errors).toEqual([]);
  });

  it("compare mode opens cards side by side", async () => {
    await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByText("Compare mode is on")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "teamLab Planets — open" }));
    fireEvent.click(screen.getByRole("button", { name: "Fushimi Inari at dawn — open" }));
    const drawer = screen.getByRole("region", { name: "Compare cards" });
    expect(within(drawer).getByText("2 cards")).toBeTruthy();
    expect(within(drawer).getByText("$25")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "teamLab Planets — open" })); // toggles off
    expect(within(drawer).getByText("1 card")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region", { name: "Compare cards" })).toBeNull();
    expect(errors).toEqual([]);
  });

  it("creates a trip, and deleting one needs its name typed", async () => {
    const store = await setup();
    fireEvent.click(screen.getByRole("button", { name: "New trip" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Trip name" }), { target: { value: "Rome" } });
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Budget in dollars" }), { target: { value: "1500" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Create trip" }));
    await screen.findByRole("heading", { name: "Rome" });
    expect(store.data.trips.at(-1)).toMatchObject({ name: "Rome", budget: 1500, dayCount: 3 });

    fireEvent.click(screen.getByRole("button", { name: "Back to all trips" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Japan · Cherry Season" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete trip" }));
    const confirm = screen.getByRole("dialog", { name: "Delete this trip?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete trip" }));
    expect(store.data.trips).toHaveLength(2); // not typed yet
    fireEvent.change(within(confirm).getByRole("textbox"), { target: { value: "Japan · Cherry Season" } });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete trip" }));
    await waitFor(() => expect(store.data.trips.map((t) => t.name)).toEqual(["Rome"]));
    expect(store.data.cards.some((c) => c.trip === "t1")).toBe(false);
    expect(errors).toEqual([]);
  });

  it("map tab draws located stops, frames a day, and drops the old street cache", async () => {
    localStorage.setItem("trip-map-osm:1,2,3,4", "{}");
    const data = seedTrips();
    // Start from no coordinates (the seed has some) and place exactly four.
    data.cards.forEach((c) => (c.loc = null));
    const at = (id: string, lat: number, lng: number) => (data.cards.find((c) => c.id === id)!.loc = { lat, lng });
    at("c1", 35.649, 139.789); at("c2", 35.66, 139.7); at("c3", 35.685, 139.71); at("c7", 35.005, 135.764);
    await setup(data);
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: /^Map/ }));
    const map = await screen.findByTestId("trip-map"); // the canvas loads lazily
    const pins = () => screen.getByTestId("trip-map").querySelectorAll(".pin");
    expect(pins()).toHaveLength(4);
    expect(screen.getByText("4 of 12 cards on the map")).toBeTruthy();
    expect(localStorage.getItem("trip-map-osm:1,2,3,4")).toBeNull();
    const allFrame = map.dataset.frame;
    fireEvent.click(screen.getByRole("button", { name: "Day 2" }));
    expect(pins()).toHaveLength(1);
    expect(screen.getByTestId("trip-map").dataset.frame).not.toBe(allFrame);
    // A side-list row opens the stop's card beside the list; any later click closes it.
    fireEvent.click(screen.getByRole("button", { name: "Open Shinjuku Gyoen — sakura" }));
    expect(screen.getByRole("dialog", { name: "Shinjuku Gyoen — sakura" })).toBeTruthy();
    fireEvent.click(document.body);
    expect(screen.queryByRole("dialog", { name: "Shinjuku Gyoen — sakura" })).toBeNull();
  });

  it("converts currencies with the remembered pair", async () => {
    localStorage.setItem("trip-fx-pref", JSON.stringify({ f: "USD", t: "JPY" }));
    vi.stubGlobal("fetch", async (url: string) => ({ ok: true, json: async () => (expect(url).toContain("/USD"), { rates: { JPY: 150 }, time_last_update_utc: "Fri, 25 Sep 2026 00:00:01 +0000" }) }));
    await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    const panel = screen.getByRole("region", { name: "Currency converter" });
    await within(panel).findByText("1 USD = 150.0000 JPY");
    expect(within(panel).getByText("15,000.00")).toBeTruthy();
    fireEvent.change(within(panel).getByRole("textbox", { name: "Amount to convert" }), { target: { value: "2" } });
    expect(within(panel).getByText("300.00")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Swap currencies" }));
    expect(JSON.parse(localStorage.getItem("trip-fx-pref")!)).toEqual({ f: "JPY", t: "USD" });
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(screen.queryByRole("region", { name: "Currency converter" })).toBeNull();
  });
});

