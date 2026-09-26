import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { GeoStat } from "@/lib/collection/geo";
import { MALVINAS, loadProvinces, norm, placedTotals, provinceLabel, provinceMatcher, zoomToBounds, type Province } from "./argentina";

const file = JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/geo/ar-provinces.json"), "utf8"));
const prov = (provincia: string): Province => ({ type: "Feature", properties: { provincia }, geometry: { type: "Polygon", coordinates: [] } });
const stat = (region: string, count: number): GeoStat => ({ region, count, items: [] });

describe("argentina provinces", () => {
  it("ships every province with a small, simplified geometry", () => {
    const names = new Set(file.features.map((f: Province) => norm(f.properties.provincia)));
    for (const p of ["Buenos Aires", "Capital Federal", "Córdoba", "Mendoza", "Neuquén", "Tierra del Fuego", "Tucumán", "Salta", "Santa Cruz"])
      expect(names.has(norm(p)), p).toBe(true);
    expect(names.size).toBe(24);
    expect(fs.statSync(path.join(__dirname, "../../public/geo/ar-provinces.json")).size).toBeLessThan(500_000);
  });

  it("matches stats by name, accent-insensitive, or by the first comma segment", () => {
    const hit = provinceMatcher([stat("Neuquén", 2), stat("Tucuman", 1), stat("Argentina", 5)]);
    expect(hit(prov("Neuquen"))?.count).toBe(2);
    expect(hit(prov("Tucumán, Argentina"))?.count).toBe(1);
    expect(hit(prov("Mendoza"))).toBeNull();
  });

  it("counts each matched region once, even when two features share it", () => {
    const features = [prov("Tierra del Fuego"), MALVINAS, prov("Mendoza"), prov("Salta")];
    expect(placedTotals(features, [stat("Tierra del Fuego", 3), stat("Mendoza", 2), stat("Chile", 9)])).toEqual({ provinces: 2, items: 5 });
    expect(provinceLabel(MALVINAS)).toBe("Islas Malvinas");
    expect(provinceLabel(prov("Rio Negro, Argentina"))).toBe("Rio Negro");
  });

  it("zooms to frame a province at 70% of the view, between 1x and 10x", () => {
    const t = zoomToBounds([[400, 300], [500, 400]], 1000, 1000);
    expect(t.k).toBeCloseTo(7);
    expect(t.x).toBeCloseTo(500 - 7 * 450);
    expect(t.y).toBeCloseTo(500 - 7 * 350);
    expect(zoomToBounds([[0, 0], [1000, 1000]], 1000, 1000).k).toBe(1);
    expect(zoomToBounds([[0, 0], [1, 1]], 1000, 1000).k).toBe(10);
  });

  it("loads once, adds the Malvinas, and retries after a failure", async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    await expect(loadProvinces(bad)).rejects.toThrow("HTTP 503");
    const good = vi.fn(async () => ({ ok: true, json: async () => file }) as Response);
    const a = await loadProvinces(good);
    const b = await loadProvinces(good);
    expect(a).toBe(b);
    expect(good).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(file.features.length + 1);
    expect(a.at(-1)).toBe(MALVINAS);
  });
});
