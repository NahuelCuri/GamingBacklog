// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { byOrder, seedTrips } from "@/lib/trips/model";
import { memoryTripStore } from "@/lib/trips/store";
import { TripPlanner } from "./TripPlanner";

vi.mock("@/components/shell/ShellProvider", () => ({ useShell: () => ({ libs: ["games"], navigate: vi.fn(), openSettings: vi.fn() }) }));
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
    expect(screen.getByText("$18,820 of $4,200")).toBeTruthy();
    openJapan();
    expect(screen.getByRole("heading", { name: "Japan · Cherry Season" })).toBeTruthy();
    expect(location.search).toBe("?trip=t1&tab=cards");
    expect(screen.getAllByRole("button", { name: / — open$/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole("tab", { name: "Itinerary · 6" }));
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
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), { target: { value: "kyoto" } });
    expect(screen.getAllByRole("button", { name: / — open$/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["Nishiki Market crawl — open"]);
  });

  it("creates, views, edits and deletes a card with undo", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "+ New card" }));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Card title" }), { target: { value: "Tsukiji breakfast" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Food" }));
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

  it("schedules with the keyboard and quick-adds to the pool", async () => {
    const store = await setup();
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: "Itinerary · 6" }));
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

    fireEvent.click(screen.getByRole("button", { name: "+ Add day" }));
    await waitFor(() => expect(store.data.trips[0].dayCount).toBe(5));
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
    expect(within(drawer).getByText("$3800")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "teamLab Planets — open" })); // toggles off
    expect(within(drawer).getByText("1 card")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region", { name: "Compare cards" })).toBeNull();
    expect(errors).toEqual([]);
  });

  it("creates a trip, and deleting one needs its name typed", async () => {
    const store = await setup();
    fireEvent.click(screen.getByRole("button", { name: "+ New trip" }));
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

  it("map tab draws located stops and falls back when streets fail", async () => {
    const data = seedTrips();
    const at = (id: string, lat: number, lng: number) => (data.cards.find((c) => c.id === id)!.loc = { lat, lng });
    at("c1", 35.649, 139.789); at("c2", 35.66, 139.7); at("c3", 35.685, 139.71); at("c7", 35.005, 135.764);
    await setup(data);
    openJapan();
    fireEvent.click(screen.getByRole("tab", { name: "Map · 4" }));
    const pins = () => screen.getByTestId("trip-map").querySelectorAll("g.pin");
    expect(pins()).toHaveLength(4);
    expect(screen.getByText("3 numbered · 4 of 12 cards located")).toBeTruthy();
    await screen.findByText(/Street data unavailable/);
    fireEvent.click(screen.getByRole("button", { name: "Day 2" }));
    expect(pins()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open Shinjuku Gyoen — sakura" }));
    expect(screen.getByRole("dialog", { name: "Shinjuku Gyoen — sakura" })).toBeTruthy();
    expect(location.search).toContain("card=c3");
  });

  it("converts currencies with the remembered pair", async () => {
    localStorage.setItem("trip-fx-pref", JSON.stringify({ f: "USD", t: "JPY" }));
    vi.stubGlobal("fetch", async (url: string) => ({ ok: true, json: async () => (expect(url).toContain("/USD"), { rates: { JPY: 150 }, time_last_update_utc: "Fri, 25 Sep 2026 00:00:01 +0000" }) }));
    await setup();
    openJapan();
    fireEvent.click(screen.getByRole("button", { name: "⇄ Convert" }));
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

