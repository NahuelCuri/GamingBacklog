"use client";

// Library tab: metric strip, search + filters, the item table, and the empty
// states.
import { useEffect, useMemo, useState } from "react";
import { CaretLeftIcon, CaretRightIcon, CloseIcon, ResetIcon, SearchIcon } from "@/components/icons";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Pill, PillGroup, accentButton, secondaryButton } from "@/components/ui/Pills";
import { buildStrip, categoryValues, currentMonthKey, ledgerMonths, nextSort, shiftMonth, visibleRows, type LibraryFilters } from "@/lib/collection";
import { monthKey, monthLabel } from "@/lib/collection/format";
import { hasMonth } from "@/lib/data/collection-state";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";
import { ItemTable, ItemTableSkeleton } from "./ItemTable";

export function LibraryView() {
  const { cfg, data, items, actions, money, isMobile, url, setUrl, openAdd } = useCollectionCtx();
  const [sort, setSort] = useState<Pick<LibraryFilters, "sortKey" | "sortDir">>({ sortKey: "default", sortDir: "asc" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Ledger collections (expenses) show one month at a time, the current one first.
  const [month, setMonth] = useState(currentMonthKey);
  // Expenses read one month from the server at a time; this asks for the one picked.
  useEffect(() => {
    if (cfg.ledgerMonth) actions?.loadMonth(month);
  }, [cfg.ledgerMonth, actions, month, data.status, data.months]);
  // What the strip, the category chips and the table work on: the month shown, for ledgers.
  const scoped = useMemo(() => (cfg.ledgerMonth ? items.filter((g) => monthKey(g.date) === month) : items), [cfg.ledgerMonth, items, month]);
  const [rowLimit, setRowLimit] = useState<number | undefined>(undefined);

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
  const categories = useMemo(() => {
    if (cfg.dynamicCategories) return [{ value: "all", label: "All" }, ...categoryValues(cfg, scoped).map((v) => ({ value: v, label: v }))];
    return cfg.categoryFilters || [];
  }, [cfg, scoped]);

  const addTag = (t: string) => setUrl((s) => (s.tagFilters.includes(t) ? {} : { tagFilters: [...s.tagFilters, t] }));
  const onDelete = (g: Item) => {
    if (pendingDelete === g.id) {
      actions?.remove(g.id);
      setPendingDelete(null);
      setExpandedId(null);
    } else setPendingDelete(g.id);
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

      {categories.length > 1 && (
        <PillGroup label="Category" bare className={"mb-[14px] " + (isMobile ? "g-noscroll w-full overflow-x-auto" : "flex-wrap")}>
          {categories.map((c) => (
            <Pill key={c.value} quiet active={url.catFilter === c.value} onClick={() => setUrl({ catFilter: c.value })} className={pillSize}>
              {c.label}
            </Pill>
          ))}
        </PillGroup>
      )}

      {url.tagFilters.length > 0 && (
        <div className="mb-[14px] flex flex-wrap gap-[7px]">
          {url.tagFilters.map((t, i) => (
            <button
              key={i}
              type="button"
              aria-label={"Remove tag " + t}
              onClick={() => setUrl((s) => ({ tagFilters: s.tagFilters.filter((x) => x !== t) }))}
              className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border px-2.5 py-[5px] text-xs text-accent transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[.97]"
              style={{
                background: "color-mix(in srgb, var(--accent) 13%, transparent)",
                borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
            >
              {t}
              <CloseIcon size={10} />
            </button>
          ))}
        </div>
      )}

      {!loaded && data.status !== "error" && <ItemTableSkeleton />}

      {loaded && rows.length > 0 && (
        <ItemTable
          view={view}
          sort={sort}
          onSort={(k) => setSort((s) => nextSort(s, k))}
          expandedId={expandedId}
          onToggle={(id) => {
            setExpandedId((cur) => (cur === id ? null : id));
            setPendingDelete(null);
          }}
          pendingDelete={pendingDelete}
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
