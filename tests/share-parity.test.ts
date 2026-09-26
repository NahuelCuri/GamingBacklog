// Parity for the share builders (legacy CollectionLib.buildShare / buildShareCard).
import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import {
  defaultCardSelection, scopeItems, shareCard, shareModules, shareYears, withYearMode, type CollectionKey, type ShareBlock, type ShareScope,
} from "@/lib/collection";
import { ACCENT, KEYS, legacyLib, legacySelf, normalize, plain, seed } from "./legacy";

/* eslint-disable @typescript-eslint/no-explicit-any */
function legacyModule(o: any): unknown {
  switch (o.kind) {
    case "sCards": return { kind: "cards", title: o.title, cards: o.cards };
    case "sBar":
      return {
        kind: "bar", title: o.title, rows: o.rows,
        style: { showRank: o.showRank, labelWidth: o.labelWidth, labelColor: o.labelColor, labelSize: o.labelSize, barOpacity: o.barOpacity, rowGap: o.rowGap, valColor: o.valColor, valWidth: o.valWidth, valSize: o.valSize, valWeight: o.valWeight },
      };
    case "sHistogram": return { kind: "histogram", title: o.title, bars: o.bars };
    case "sByYear": return { kind: "byYear", title: o.title, bars: o.bars };
    case "sSpending": return { kind: "spending", title: o.title, has: o.has, total: o.total, donut: o.donut, emptyMsg: o.emptyMsg, legend: o.legend };
  }
}
const mine = (m: ShareBlock) => {
  const { key: _k, ...rest } = m;
  return rest;
};

describe.each(KEYS)("%s share", (key: CollectionKey) => {
  const cfg = COLLECTIONS[key];
  const items = seed(key);
  const allOn = Object.fromEntries(cfg.stats.shareModules.map((m) => [m.key, true]));
  const years = shareYears(cfg, items);
  const scopes: ShareScope[] = [
    { mode: "all", year: "", from: "", to: "" },
    ...years.slice(-2).map((y) => ({ mode: "year" as const, year: y, from: "", to: "" })),
    ...(years.length > 1 ? [{ mode: "range" as const, year: "", from: years.at(-1)!, to: years[0] }] : []),
  ];

  it.each(scopes)("stats image modules and scope (%o)", (scope) => {
    const old = normalize(
      plain(
        legacyLib.buildShare(
          legacySelf(key, items, { exportYearMode: scope.mode, exportYear: scope.year, exportFrom: scope.from, exportTo: scope.to, exportSel: allOn }),
        ),
      ),
    );
    const { items: scoped, label } = scopeItems(cfg, items, scope);
    expect(label).toBe(old.expScopeLabel);
    expect(normalize(shareModules(cfg, scoped, allOn, ACCENT)).map(mine)).toEqual(old.modules.map(legacyModule));
    expect(years).toEqual(old.expYearOptions.map((o: any) => o.value));
  });

  it("year mode switches pre-fill like legacy", () => {
    const empty: ShareScope = { mode: "all", year: "", from: "", to: "" };
    const y = withYearMode(cfg, items, empty, "year");
    const r = withYearMode(cfg, items, empty, "range");
    expect(y.year).toBe(years.at(-1) ?? "");
    expect([r.from, r.to]).toEqual([years[0] ?? "", years.at(-1) ?? ""]);
  });

  it("item cards match legacy for every seed item (default and full selection)", () => {
    for (const g of items) {
      for (const sel of [defaultCardSelection(cfg, g), Object.fromEntries(Object.keys(g).map((k) => [k, true]))]) {
        const o = normalize(plain(legacyLib.buildShareCard(legacySelf(key, items, { shareItem: g, shareCardSel: sel }))));
        const c = normalize(shareCard(cfg, g, sel));
        expect(c.chips.map((x) => [x.key, x.label, x.on])).toEqual(o.chips.map((x: any) => [x.key, x.label, x.on]));
        expect(c.empty).toBe(o.isEmpty);
        expect(c.title).toBe(o.itemTitle);
        expect(c.score ? [c.score.value, c.score.max, c.score.color, c.score.label] : null).toEqual(o.hasScore ? [o.scoreValue, o.scoreMax, o.scoreCol, o.scoreLabel] : null);
        expect(c.status ? [c.status.label, c.status.dot, c.status.glow, c.status.text] : null).toEqual(
          o.hasStatus ? [o.statusLabel, o.statusDot, o.statusGlow, o.statusTextCol] : null,
        );
        expect(c.stats).toEqual(o.statCells);
        expect(c.tagGroups).toEqual(o.tagGroups.map((t: any) => ({ label: t.label, tags: t.chips.map((x: any) => x.tag) })));
        expect(c.review).toEqual(o.hasReview ? { label: o.reviewLabel, text: o.reviewText } : null);
      }
    }
  });
});
