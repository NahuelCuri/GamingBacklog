// Parity: the TypeScript port must produce the same results as the legacy
// collection-lib.js / spending.js for every collection's real seed data.
import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import {
  blankDraft, buildGeo, buildStats, buildStrip, cellValue, cornerLink, detailRows, draftFromItem, itemFromDraft,
  matches, metric, monthCards, monthDetail, pickSuggestions, pool, reelCard, sorted, tagCloud, visibleRows,
  type CollectionKey, type Item, type LibraryFilters, type RouletteState, type Widget,
} from "@/lib/collection";
import { donutFromParts, matchSel, moneyFormat, spend, usd } from "@/lib/spending";
import { ACCENT, KEYS, legacyConfigs, legacyLib, legacySeeds, legacySelf, legacySpending, normalize, plain, seed } from "./legacy";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ids = (list: Item[] | any[]) => list.map((x) => x.id);

describe.each(KEYS)("%s", (key: CollectionKey) => {
  const cfg = COLLECTIONS[key];
  const items = seed(key);

  it("config matches the legacy config exactly", () => {
    expect(JSON.parse(JSON.stringify(cfg))).toEqual(plain(legacyConfigs[key]));
  });

  it("seed matches the legacy seed", () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items).toEqual(plain(legacySeeds[key]));
  });

  // ------------------------------------------------------------ metrics

  it("metrics (summary + strip)", () => {
    for (const spec of [...cfg.stats.summary, ...cfg.stats.strip]) {
      expect(metric(cfg, items, spec), spec.label).toEqual(plain(legacyLib.metric(legacyConfigs[key], items, spec)));
    }
    expect(normalize(buildStrip(cfg, items))).toEqual(
      normalize(plain(legacyLib.buildStrip(legacySelf(key, items))).map((s: any) => ({ label: s.label, value: s.value, color: s.color }))),
    );
  });

  // ------------------------------------------------------------ filter / sort

  const tags = Object.keys(legacyLib.tagCounts(legacyConfigs[key], items));
  const words = [String(items[0][cfg.modal.titleField]).split(" ")[0].toLowerCase(), "the", "a e", "zzzz-no-match"];
  const filterStates: Partial<LibraryFilters>[] = [
    {},
    ...cfg.statusFilters.map((c) => ({ status: c.value })),
    ...words.map((q) => ({ q })),
    ...(tags.length ? [{ tagFilters: [tags[0]] }, { tagFilters: tags.slice(0, 2) }] : []),
    ...(cfg.categoryField ? [{ catFilter: String(items[0][cfg.categoryField]) }] : []),
  ];
  const sortStates = [
    { sortKey: "default", sortDir: "asc" as const },
    ...cfg.table.columns.filter((c) => c.sortable).flatMap((c) => [
      { sortKey: c.key, sortDir: "asc" as const },
      { sortKey: c.key, sortDir: "desc" as const },
    ]),
  ];
  const full = (p: Partial<LibraryFilters>): LibraryFilters => ({ q: "", status: "all", catFilter: "all", tagFilters: [], sortKey: "default", sortDir: "asc", ...p });

  it("matches + sorted", () => {
    for (const f of filterStates) {
      for (const s of sortStates) {
        const st = full({ ...f, ...s });
        const mine = sorted(cfg, items.filter((g) => matches(cfg, g, st)), st);
        const old = legacyLib.sorted(legacyConfigs[key], items.filter((g) => legacyLib.matches(legacyConfigs[key], g, st)), st);
        expect(ids(mine), JSON.stringify(st)).toEqual(ids(old));
      }
    }
  });

  // ------------------------------------------------------------ table

  const tableCases: [Partial<LibraryFilters>, Record<string, unknown>][] = [
    [{}, {}],
    [{}, { showAllLedger: true }],
    [{}, { rowLimit: 5 }],
    [{ status: cfg.statusFilters[1].value }, {}],
    [{ sortKey: cfg.table.columns[0].key, sortDir: "desc" }, { showAllLedger: true, rowLimit: 300 }],
  ];

  it.each(tableCases)("table rows, ledger and paging %#", (f, opts) => {
    const st = full(f);
    const mine = visibleRows(cfg, items, st, opts as any);
    const old = plain(legacyLib.buildTable(legacySelf(key, items, { ...st, ...opts })));
    expect(ids(mine.rows)).toEqual(ids(old.rows));
    const { onLoadAll: _a, ...ledger } = old.ledger;
    expect(mine.ledger).toEqual(ledger);
    const { onMore: _b, ...more } = old.more;
    expect(mine.more).toEqual(more);
  });

  it("table cells, detail fields and corner link", () => {
    const old = normalize(plain(legacyLib.buildTable(legacySelf(key, items, { showAllLedger: true, rowLimit: 1000 }))));
    const byId = new Map(items.map((g) => [g.id, g]));
    for (const row of old.rows) {
      const g = byId.get(row.id)!;
      cfg.table.columns.forEach((col, i) => {
        const oc = row.cells[i], c = normalize(cellValue(cfg, col, g));
        if (c.kind === "title") expect(c.text).toEqual(String(oc.text ?? ""));
        else if (c.kind === "tags") expect(c.tags).toEqual(oc.chips.map((x: any) => x.tag));
        else if (c.kind === "status") expect([c.meta.label, c.meta.dot, c.meta.glow, c.meta.text]).toEqual([oc.label, oc.dot, oc.glow, oc.text]);
        else expect([c.text, c.color], `${row.id}.${col.key}`).toEqual([oc.text, oc.color]);
      });
      expect(
        normalize(detailRows(cfg, g)).map((r) => [r.label, r.value, r.link?.url, r.link?.pulse]),
      ).toEqual(
        // legacy passes raw numbers through; the port always yields display strings
        row.detailFields.map((d: any) => [d.label, String(d.value), d.hasLink ? d.linkUrl : undefined, d.hasLink ? d.iconAnim !== "none" : undefined]),
      );
      const cl = cornerLink(cfg, g);
      expect(cl ? [cl.url, cl.label, cl.pulse] : null).toEqual(row.cornerLink.show ? [row.cornerLink.url, row.cornerLink.label, row.cornerLink.anim !== "none"] : null);
    }
  });

  // ------------------------------------------------------------ drafts

  it("drafts round-trip like legacy", () => {
    const blank = blankDraft(cfg);
    if (cfg.modal.autoDateField) delete blank[cfg.modal.autoDateField];
    const oldBlank = plain(legacyLib.blankDraft(legacyConfigs[key]));
    if (cfg.modal.autoDateField) delete oldBlank[cfg.modal.autoDateField];
    expect(blank).toEqual(oldBlank);
    for (const g of items) {
      const d = draftFromItem(cfg, g);
      expect(d).toEqual(plain(legacyLib.draftFromItem(legacyConfigs[key], g)));
      expect(itemFromDraft(cfg, d)).toEqual(plain(legacyLib.itemFromDraft(legacyConfigs[key], d)));
    }
  });

  // ------------------------------------------------------------ roulette

  if (cfg.roulette) {
    const r = cfg.roulette;
    const states: Partial<RouletteState>[] = [];
    for (const s of r.statusFilters) for (const b of r.band?.options ?? [{ value: "any" }]) states.push({ rStatus: s.value, rLength: b.value });
    if (tags.length) states.push({ rStatus: "all", rTags: tags.slice(0, 3) });
    states.push({ rmode: "picked", rPicked: ids(items.slice(0, 4)) });

    it("roulette pool", () => {
      for (const s of states) {
        const st: RouletteState = { rmode: "filters", rStatus: "backlog", rLength: "any", rTags: [], rPicked: [], ...s };
        expect(ids(pool(cfg, items, st)), JSON.stringify(s)).toEqual(ids(legacyLib.pool(legacyConfigs[key], items, st)));
      }
    });

    it("roulette tag cloud, suggestions and reel cards", () => {
      const reel = items.slice(0, 12);
      const old = normalize(plain(legacyLib.buildRoulette(legacySelf(key, items, { rSearch: "a", rTags: tags.slice(0, 1), reel }))));
      expect(tagCloud(cfg, items)).toEqual(old.rTagCloud.map((t: any) => ({ tag: t.tag, count: t.count })));
      expect(pickSuggestions(cfg, items, [], "a").map((g) => g[cfg.modal.titleField])).toEqual(old.rSuggest.map((s: any) => s.title));
      expect(normalize(reel.map((g) => reelCard(cfg, g))).map((c) => [c.title, c.dot, c.sub, c.glow])).toEqual(
        old.reelItems.map((c: any) => [c.title, c.dot, c.sub, c.glow !== "none"]),
      );
      expect(old.poolCount).toBe(pool(cfg, items, { rmode: "filters", rStatus: "backlog", rLength: "any", rTags: tags.slice(0, 1), rPicked: [] }).length);
    });
  }

  // ------------------------------------------------------------ stats

  const years = [...new Set(items.map((g) => g.yearCompleted).filter(Boolean).map(String))];
  it.each(["all", ...years.slice(0, 2)])("stats widgets (spendYear=%s)", (spendYear) => {
    const mine = normalize(buildStats(cfg, items, { accent: ACCENT, spendYear }));
    const old = normalize(plain(legacyLib.buildStats(legacySelf(key, items, { spendYear }))));
    expect(mine.summary.map((s) => [s.label, s.value, s.size])).toEqual(old.summary.map((s: any) => [s.label, s.value, s.size]));
    const side = (ws: Widget[]) => ws.map(comparable);
    expect(side(mine.left)).toEqual(old.left.map(legacyComparable));
    expect(side(mine.right)).toEqual(old.right.map(legacyComparable));
  });

  if (cfg.geo) {
    it("geo aggregation", () => {
      const { accent: _a, ...old } = plain(legacyLib.buildGeo(legacySelf(key, items)));
      expect(buildGeo(cfg, items)).toEqual(old);
    });
  }

  if (cfg.months) {
    it("months cards and every month drill-down", () => {
      const old = normalize(plain(legacyLib.buildMonths(legacySelf(key, items))));
      expect(normalize(monthCards(cfg, items))).toEqual(old.months.map(({ openLabel: _o, ...m }: any) => m));
      for (const m of old.months) {
        const o = normalize(plain(legacyLib.buildMonths(legacySelf(key, items, { openMonth: m.key })))).open;
        const d = normalize(monthDetail(cfg, items, m.key))!;
        expect({ ...d, txns: d.txns.map(({ id: _i, ...t }) => t) }).toEqual({
          ...o,
          txns: o.txns.map(({ openLabel: _l, ...t }: any) => t),
        });
      }
      expect(monthDetail(cfg, items, "1999-01")).toBeNull();
    });
  }
});

// ---------------------------------------------------------------- widget shape mapping

function comparable(w: Widget): unknown {
  switch (w.kind) {
    case "barList": return { kind: w.kind, title: w.title, rows: w.rows, showRank: w.showRank, podium: w.podium };
    case "histogram": case "byYear": return { kind: w.kind, title: w.title, bars: w.bars };
    case "statusDonut": return { kind: w.kind, title: w.title, donut: w.donut, center: [w.centerValue, w.centerLabel], legend: w.legend };
    case "moneyDonut":
      return { kind: w.kind, title: w.title, donut: w.donut, center: [w.centerValue, w.centerLabel, w.centerSize], year: w.year, yearOptions: w.yearOptions, legend: w.legend };
    case "trend": return { kind: w.kind, title: w.title, bars: w.bars, empty: w.empty };
    case "heatmap": return { kind: w.kind, title: w.title, weeks: w.weeks, monthCols: w.monthCols };
  }
}

function legacyComparable(o: any): unknown {
  switch (o.kind) {
    case "barList":
      return { kind: o.kind, title: o.title, rows: o.rows, showRank: o.showRank, podium: o.podiumRow.map((p: any) => ({ rank: p.rank, title: p.title, score: p.score })) };
    case "histogram": case "byYear": return { kind: o.kind, title: o.title, bars: o.bars };
    case "statusDonut": return { kind: o.kind, title: o.title, donut: o.donutStyle, center: [o.centerValue, o.centerLabel], legend: o.legend };
    case "moneyDonut":
      return { kind: o.kind, title: o.title, donut: o.donutStyle, center: [o.centerValue, o.centerLabel, o.centerSize], year: o.yearValue, yearOptions: o.yearOptions, legend: o.legend };
    case "trend": return { kind: o.kind, title: o.title, bars: o.bars, empty: o.empty };
    case "heatmap": return { kind: o.kind, title: o.title, weeks: o.weeks, monthCols: o.monthCols };
  }
}

// ---------------------------------------------------------------- spending

describe("spending", () => {
  const games = seed("games");
  const sels = ["all", "owned", { field: "platform", eq: "Pirated" }, { field: "platform", in: ["Steam", "EA"] }, { field: "platform", notIn: ["GamePass"] }, null];

  it("matchSel + spend", () => {
    for (const sel of sels) {
      expect(games.map((g) => matchSel(g, sel as any))).toEqual(games.map((g) => legacySpending.matchSel(g, sel)));
      expect(spend(games, sel as any)).toBe(legacySpending.spend(games, sel));
    }
  });

  it("money formatting in USD and an alternate currency", () => {
    const values = [0, 1, 12.5, 1234.5, -99.99, "7", null, "", undefined, 1e6];
    for (const [code, symbol, rate] of [["USD", "$", 1], ["ARS", "AR$", 1180.5]] as const) {
      legacySpending.setCurrency(code, symbol, rate);
      const m = moneyFormat({ code, symbol, rate });
      for (const v of values) {
        expect(m.money(v), `money(${v})`).toBe(legacySpending.money(v));
        expect(m.money2(v), `money2(${v})`).toBe(legacySpending.money2(v));
      }
    }
    legacySpending.setCurrency("USD", "$", 1);
    expect(usd.money(1234.5)).toBe("$1,235");
  });

  it("donutFromParts", () => {
    for (const parts of [[], [{ value: 0, color: "red" }], [{ value: 1, color: "a" }, { value: 3, color: "b" }]]) {
      expect(donutFromParts(parts)).toBe(legacySpending.donutFromParts(parts));
    }
  });
});
