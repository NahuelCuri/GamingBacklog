"use client";

// Library tab: metric strip, search + filters, the item table, and the empty
// states.
import { useEffect, useMemo, useState } from "react";
import { CaretLeftIcon, CaretRightIcon, CloseIcon, ResetIcon, SearchIcon } from "@/components/icons";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Pill, PillGroup, accentButton, secondaryButton } from "@/components/ui/Pills";
import { buildStrip, categoryValues, duplicateTitles, matches, tagCounts, currentMonthKey, ledgerMonths, nextSort, shiftMonth, visibleRows, type LibraryFilters } from "@/lib/collection";
import { monthKey, monthLabel } from "@/lib/collection/format";
import { hasMonth } from "@/lib/data/collection-state";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";
import { GoalCard } from "./goal/Goal";
import { ItemTable, ItemTableSkeleton } from "./ItemTable";

export function LibraryView() {
  const { cfg, data, items, actions, money, isMobile, url, setUrl, openAdd, removeItem } = useCollectionCtx();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Ledger collections (expenses) show one month at a time, the current one first.
  const [month, setMonth] = useState(currentMonthKey);
  // Expenses read one month from the server at a time; this asks for the one picked.
  useEffect(() => {
    if (cfg.ledgerMonth) actions?.loadMonth(month);
  }, [cfg.ledgerMonth, actions, month, data.status, data.months]);
  // What the strip, the category chips and the table work on: the month shown, for ledgers.
  const scoped = useMemo(() => (cfg.ledgerMonth ? items.filter((g) => monthKey(g.date) === month) : items), [cfg.ledgerMonth, items, month]);
  const [rowLimit, setRowLimit] = useState<number | undefined>(undefined);

  // The order is in the URL with the filters, so a sorted view can be linked and survives a reload.
  const sort = useMemo(() => ({ sortKey: url.sortKey, sortDir: url.sortDir }), [url.sortKey, url.sortDir]);
  const setSort = (s: Pick<LibraryFilters, "sortKey" | "sortDir">) => setUrl(s);
  const filters: LibraryFilters = { q: url.q, status: url.status, catFilter: url.catFilter, tagFilters: url.tagFilters, ...sort };
  const view = useMemo(
    () => visibleRows(cfg, items, filters, { month, rowLimit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, items, url.q, url.status, url.catFilter, url.tagFilters, sort, month, rowLimit],
  );
  const months = useMemo(() => (cfg.ledgerMonth ? ledgerMonths(items, currentMonthKey(), month) : []), [cfg, items, month]);
  const pickMonth = (k: string) => {
    setMonth(k);
    setRowLimit(undefined);
    setExpandedId(null);
  };
  const strip = useMemo(() => buildStrip(cfg, scoped, money), [cfg, scoped, money]);
  // The same title twice is usually an accidental re-add.
  const dupes = useMemo(() => (cfg.ledgerMonth ? [] : duplicateTitles(cfg, items)), [cfg, items]);
  const categories = useMemo(() => {
    if (cfg.dynamicCategories) return [{ value: "all", label: "All" }, ...categoryValues(cfg, scoped).map((v) => ({ value: v, label: v }))];
    return cfg.categoryFilters || [];
  }, [cfg, scoped]);

  // Every tag with how many it's on, most used first; picked ones stay listed even at 0.
  // Ordered by how common each tag is (so the list doesn't jump around), counted over what the other
  // filters and the tags already picked leave: the count is what picking it would show.
  const cloud = useMemo(() => {
    const all = tagCounts(cfg, scoped);
    url.tagFilters.forEach((t) => (all[t] ??= 0));
    const st = { q: url.q, status: url.status, catFilter: url.catFilter, tagFilters: url.tagFilters, sortKey: "default", sortDir: "asc" as const };
    const now = tagCounts(cfg, scoped.filter((g) => matches(cfg, g, st)));
    return Object.keys(all)
      .sort((a, b) => all[b] - all[a] || a.localeCompare(b))
      .map((tag) => ({ tag, count: now[tag] || 0 }));
  }, [cfg, scoped, url.q, url.status, url.catFilter, url.tagFilters]);
  const addTag = (t: string) => setUrl((s) => (s.tagFilters.includes(t) ? {} : { tagFilters: [...s.tagFilters, t] }));
  const onDelete = (g: Item) => {
    removeItem(g);
    setExpandedId(null);
  };
  const isDefaultSort = sort.sortKey === "default";
  const loaded = cfg.ledgerMonth ? hasMonth(data, month) : data.status === "ready";
  // A ledger holding one month can't tell "empty library" from "empty month".
  const empty = loaded && items.length === 0 && (!cfg.ledgerMonth || data.full);
  const rows = view.rows;
  const showMonth = !!cfg.ledgerMonth && months.length > 0;

  const pillSize = "text-[12.5px] font-medium " + (isMobile ? "flex-[1_0_auto] px-2.5 py-2.5 whitespace-nowrap" : "px-3 py-1.5");
  const arrow =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted transition-[color,background-color,transform] duration-150 not-disabled:hover:bg-wc not-disabled:hover:text-text not-disabled:active:scale-[.94] disabled:cursor-default disabled:opacity-30";

  return (
    <div>
      {/* Ledgers: the month heads the page; the strip below is that month's summary. */}
      {showMonth && (
        <div className="-ml-2 flex items-center gap-0.5 pt-[22px]">
          <button type="button" onClick={() => pickMonth(shiftMonth(month, -1))} aria-label="Previous month" title="Previous month" className={arrow}>
            <CaretLeftIcon size={15} />
          </button>
          <MonthPicker value={month} onChange={pickMonth} max={currentMonthKey()} large className="py-1" />
          <button
            type="button"
            disabled={month >= currentMonthKey()}
            onClick={() => pickMonth(shiftMonth(month, 1))}
            aria-label="Next month"
            title="Next month"
            className={arrow}
          >
            <CaretRightIcon size={15} />
          </button>
          {month !== currentMonthKey() && (
            <button type="button" onClick={() => pickMonth(currentMonthKey())} className="ml-2 cursor-pointer border-none bg-transparent p-0 text-[12.5px] text-accent underline-offset-2 hover:underline">
              This month
            </button>
          )}
        </div>
      )}

      {/* One scrollable line on mobile instead of a ragged 4-line wrap. */}
      <div
        className={
          "flex pb-5 font-mono text-[12.5px] tabular-nums " +
          (showMonth ? "pt-2.5 " : "pt-[22px] ") +
          (isMobile ? "g-noscroll -mx-[14px] overflow-x-auto px-[14px] whitespace-nowrap" : "flex-wrap px-1")
        }
        style={{
          gap: isMobile ? 18 : 26,
          maskImage: isMobile ? "linear-gradient(90deg, #000 calc(100% - 32px), transparent)" : undefined,
        }}
      >
        {strip.map((m) => (
          <div key={m.label} className="flex-none">
            <span className="font-semibold" style={{ color: m.color }}>
              {m.value}
            </span>{" "}
            <span className="text-dim">{m.label}</span>
          </div>
        ))}
      </div>

      {loaded && !empty && <GoalCard />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          className="flex flex-1 items-center gap-[9px] rounded-[9px] border border-wf bg-topchip px-[13px] py-[9px] text-dim max-[720px]:py-[11px] transition-colors duration-200 focus-within:border-wi focus-within:text-text2 hover:border-wh"
          style={{ minWidth: isMobile ? "100%" : 220 }}
        >
          <SearchIcon size={14} />
          <input
            type="search"
            value={url.q}
            onChange={(e) => setUrl({ q: e.target.value })}
            aria-label="Search your library"
            autoComplete="off"
            spellCheck={false}
            // Legacy used the games wording everywhere ("platform, review" on wines and expenses).
            placeholder={`Search ${cfg.nounPlural}…`}
            className="flex-1 border-none bg-transparent p-0 text-[13.5px] text-text outline-none"
          />
          {url.q && (
            <button
              type="button"
              onClick={() => setUrl({ q: "" })}
              aria-label="Clear search"
              className="-my-1 -mr-1.5 flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-dim transition-colors duration-150 hover:bg-wc hover:text-text"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
        {/* Mobile: one row that fills the width, and scrolls sideways when the labels (or their translation) don't fit. */}
        <PillGroup label="Status" bare className={isMobile ? "g-noscroll w-full overflow-x-auto" : "flex-wrap"}>
          {cfg.statusFilters.map((c) => (
            <Pill key={c.value} quiet active={url.status === c.value} onClick={() => setUrl({ status: c.value })} className={pillSize}>
              {c.label}
            </Pill>
          ))}
        </PillGroup>
        {/* Secondary filters: one button each, naming what's picked; the options open on demand. */}
        {(categories.length > 1 || cloud.length > 0) && (
          <div className={isMobile ? "grid w-full grid-cols-2 gap-2" : "flex gap-2"}>
            {categories.length > 1 && (
              <FilterMenu
                label={cfg.categoryLabel || "Category"}
                mobile={isMobile}
                options={categories.filter((c) => c.value !== "all")}
                picked={url.catFilter && url.catFilter !== "all" ? [url.catFilter] : []}
                onChange={(v) => setUrl({ catFilter: v[0] ?? "all" })}
              />
            )}
            {cloud.length > 0 && (
              <FilterMenu
                label="Tags"
                multi
                hint={`${cfg.nounPlural[0].toUpperCase() + cfg.nounPlural.slice(1)} with all the ones picked`}
                mobile={isMobile}
                options={cloud.map(({ tag, count }) => ({ value: tag, label: tag, count, disabled: !count && !url.tagFilters.includes(tag) }))}
                picked={url.tagFilters}
                onChange={(v) => setUrl({ tagFilters: v })}
              />
            )}
          </div>
        )}
        {/* Only there once the table has been re-sorted. */}
        {!isDefaultSort && (
          <button
            type="button"
            onClick={() => setSort({ sortKey: "default", sortDir: "asc" })}
            title="Reset sort order"
            aria-label="Reset sort order"
            className="flex cursor-pointer items-center self-stretch rounded-[9px] border border-wd bg-topchip px-[11px] text-text2 transition-[color,border-color,transform] duration-200 hover:border-wi hover:text-text active:translate-y-px"
          >
            <ResetIcon size={15} />
          </button>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {`${rows.length} ${cfg.nounPlural} shown`}
      </div>

      {loaded && dupes.length > 0 && (
        <div role="note" className="mb-[14px] flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
          <span className="text-[#e0b86a]">Possible duplicates</span>
          {dupes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setUrl({ q: t, status: "all", catFilter: "all", tagFilters: [] })}
              className="cursor-pointer rounded-md border border-wf bg-chip px-2 py-0.5 text-xs text-text2 hover:border-wi hover:text-text"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!loaded && data.status !== "error" && <ItemTableSkeleton />}

      {loaded && rows.length > 0 && (
        <ItemTable
          view={view}
          sort={sort}
          onSort={(k) => setSort(nextSort(sort, k))}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          onDelete={onDelete}
          onTag={addTag}
          onMore={() => setRowLimit((n) => (n || 150) + 150)}
        />
      )}

      {empty && (
        <div className="px-5 py-[70px] text-center">
          <div className="mb-2 text-[17px] font-semibold text-text2">{cfg.emptyTitle}</div>
          <div className="mx-auto mb-[22px] max-w-[52ch] text-[13px] text-pretty text-dim">{cfg.emptySub}</div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={openAdd} className={accentButton + " px-[18px] py-2.5 text-[13px] font-bold"}>
              + Add a {cfg.noun}
            </button>
            <button
              type="button"
              onClick={() => actions?.loadStarter()}
              className={secondaryButton + " px-[18px] py-2.5 text-[13px]"}
            >
              Load starter set
            </button>
          </div>
        </div>
      )}
      {loaded && !empty && rows.length === 0 && (
        <div className="px-5 py-[70px] text-center text-dim">
          <div className="mb-1.5 text-[15px]">
            {cfg.ledgerMonth ? `No ${cfg.nounPlural} in ${monthLabel(month)}.` : `No ${cfg.nounPlural} match.`}
          </div>
          <div className="text-[13px]">
            {cfg.ledgerMonth ? "Pick another month, clear filters or" : "Try clearing filters or"}{" "}
            <button type="button" onClick={openAdd} className="cursor-pointer border-none bg-transparent p-0 text-accent underline-offset-2 hover:underline">
              add a new {cfg.noun}
            </button>
            .
          </div>
        </div>
      )}
    </div>
  );
}
