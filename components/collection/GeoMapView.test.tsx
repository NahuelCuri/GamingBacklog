// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import type { Item } from "@/lib/collection/types";
import { DEFAULT_URL_STATE } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { usd } from "@/lib/spending";
import { seed } from "@/tests/legacy";
import { CollectionContext, type CollectionCtx } from "./CollectionContext";
import { GeoMapView } from "./GeoMapView";

const geojson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/geo/ar-provinces.json"), "utf8"));

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.map(String).join(" ")));
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => geojson }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderMap(items: Item[]) {
  const noop = vi.fn();
  const ctx: CollectionCtx = {
    collection: "wines", cfg: COLLECTIONS.wines, data: { ...initialCollectionState, status: "ready", items }, items,
    actions: null, money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: noop,
    openAdd: noop, openEdit: noop, openShare: noop, openStatsImage: noop,
  };
  return render(
    <CollectionContext.Provider value={ctx}>
      <GeoMapView />
    </CollectionContext.Provider>,
  );
}

const provincePaths = () => [...screen.getByTestId("geo-map").querySelectorAll<SVGPathElement>("path.prov")];

describe("GeoMapView", () => {
  const wines: Item[] = [
    ...seed("wines"),
    { id: "x1", title: "Humberto Canale", region: "Río Negro, Argentina" },
    { id: "x2", title: "Malbec de altura", region: "Salta" },
  ];

  it("draws every province and lights up the ones with wines", async () => {
    renderMap(wines);
    await waitFor(() => expect(provincePaths().length).toBe(geojson.features.length + 1));
    const lit = provincePaths().filter((p) => p.getAttribute("fill") === COLLECTIONS.wines.theme.accent);
    expect(lit).toHaveLength(3); // Mendoza, Río Negro, Salta
    const { textContent } = document.body;
    expect(textContent).toContain("3 provinces");
    expect(textContent).toContain("4 wines");
    expect(errors).toEqual([]);
  });

  it("clicking a lit province lists its wines; reset clears it", async () => {
    renderMap(wines);
    await waitFor(() => expect(provincePaths().length).toBeGreaterThan(0));
    const mendoza = provincePaths().find((p) => (p as unknown as { __data__: { properties: { provincia: string } } }).__data__.properties.provincia === "Mendoza")!;
    act(() => void mendoza.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(screen.getByText("2 wines")).toBeTruthy();
    const names = seed("wines").filter((w) => String(w.region).startsWith("Mendoza")).map((w) => String(w.title));
    names.forEach((n) => expect(screen.getByText(n)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Clear region selection" }));
    expect(screen.queryByText("2 wines")).toBeNull();
    expect(errors).toEqual([]);
  });

  it("says so when the map cannot load", async () => {
    vi.resetModules(); // drop the cached provinces
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500 }));
    const { GeoMapView: FreshMap } = await import("./GeoMapView");
    const { CollectionContext: FreshCtx } = await import("./CollectionContext");
    const noop = vi.fn();
    render(
      <FreshCtx.Provider value={{ collection: "wines", cfg: COLLECTIONS.wines, data: initialCollectionState, items: [], actions: null, money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: noop, openAdd: noop, openEdit: noop, openShare: noop, openStatsImage: noop }}>
        <FreshMap />
      </FreshCtx.Provider>,
    );
    await waitFor(() => expect(screen.getByText("map unavailable (offline)")).toBeTruthy());
  });
});
