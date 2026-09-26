"use client";

// Library tab: metric strip, search + filters, table or card layout, and the
// empty states.
import { useMemo, useState } from "react";
import { Pill, PillGroup, accentButton } from "@/components/ui/Pills";
import { buildStrip, categoryValues, nextSort, visibleRows, type LibraryFilters } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";
import { ItemCards } from "./ItemCards";
import { ItemTable } from "./ItemTable";

type Layout = "table" | "cards";

export function LibraryView() {
  const { cfg, data, items, actions, money, isMobile, url, setUrl, openAdd } = useCollectionCtx();
  const [sort, setSort] = useState<Pick<LibraryFilters, "sortKey" | "sortDir">>({ sortKey: "default", sortDir: "asc" });
  const [layout, setLayout] = useState<Layout>("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [showAllLedger, setShowAllLedger] = useState(false);
  const [rowLimit, setRowLimit] = useState<number | undefined>(undefined);

  const filters: LibraryFilters = { q: url.q, status: url.status, catFilter: url.catFilter, tagFilters: url.tagFilters, ...sort };
  const view = useMemo(
    // Cards show every match: no paging and no ledger-month cap (legacy behaviour).
    () =>
      visibleRows(cfg, items, filters, {
        showAllLedger: showAllLedger || layout === "cards",
        rowLimit: layout === "cards" ? Infinity : rowLimit,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, items, url.q, url.status, url.catFilter, url.tagFilters, sort, showAllLedger, rowLimit, layout],
  );
  const strip = useMemo(() => buildStrip(cfg, items, money), [cfg, items, money]);
  const categories = useMemo(() => {
    if (cfg.dynamicCategories) return [{ value: "all", label: "All" }, ...categoryValues(cfg, items).map((v) => ({ value: v, label: v }))];
    return cfg.categoryFilters || [];
  }, [cfg, items]);

  const addTag = (t: string) => setUrl((s) => (s.tagFilters.includes(t) ? {} : { tagFilters: [...s.tagFilters, t] }));
  const onDelete = (g: Item) => {
    if (pendingDelete === g.id) {
      actions?.remove(g.id);
      setPendingDelete(null);
      setExpandedId(null);
    } else setPendingDelete(g.id);
  };
  const isDefaultSort = sort.sortKey === "default";
  const loaded = data.status === "ready";
  const rows = view.rows;

  return (
    <div>
      <div
        className="flex flex-wrap px-1 pt-[22px] pb-5 font-mono text-[12.5px] tabular-nums"
        style={{ gap: isMobile ? "12px 18px" : 26 }}
      >
        {strip.map((m) => (
          <div key={m.label}>
            <span className="font-semibold" style={{ color: m.color }}>
              {m.value}
            </span>{" "}
            <span className="text-dim">{m.label}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          className="flex flex-1 items-center gap-[9px] rounded-[9px] border border-wf bg-topchip px-[13px] py-[9px]"
          style={{ minWidth: isMobile ? "100%" : 220 }}
        >
          <span aria-hidden className="text-sm text-dim">
            ⌕
          </span>
          <input
            type="search"
            value={url.q}
            onChange={(e) => setUrl({ q: e.target.value })}
            aria-label="Search your library"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search title, tag, platform, review…"
            className="flex-1 border-none bg-transparent p-0 text-[13.5px] text-text outline-none"
          />
          {url.q && (
            <button
              type="button"
              onClick={() => setUrl({ q: "" })}
              aria-label="Clear search"
              className="-my-1 -mr-1.5 flex h-[26px] w-[26px] cursor-pointer items-center justify-center border-none bg-transparent text-[15px] leading-none text-dim"
            >
              ×
            </button>
          )}
        </div>
        <PillGroup label="Status" className="flex-wrap">
          {cfg.statusFilters.map((c) => (
            <Pill key={c.value} active={url.status === c.value} onClick={() => setUrl({ status: c.value })} className="px-3 py-1.5 text-[12.5px] font-medium">
              {c.label}
            </Pill>
          ))}
        </PillGroup>
        <button
          type="button"
          onClick={() => setSort({ sortKey: "default", sortDir: "asc" })}
          title="Reset sort order"
          aria-label="Reset sort order"
          className="cursor-pointer rounded-[9px] border border-wd bg-topchip px-[11px] py-2 text-[15px] leading-none"
          style={{ color: isDefaultSort ? "var(--dim2)" : "var(--text2)", opacity: isDefaultSort ? 0.5 : 1 }}
        >
          ↺
        </button>
        <PillGroup label="Layout">
          <Pill active={layout === "table"} onClick={() => setLayout("table")} title="Table view" aria-label="Table view" className="px-2.5 py-1.5 text-[13px]">
            ▤
          </Pill>
          <Pill active={layout === "cards"} onClick={() => setLayout("cards")} title="Card view" aria-label="Card view" className="px-2.5 py-1.5 text-[13px]">
            ▦
          </Pill>
        </PillGroup>
      </div>

      <div aria-live="polite" className="sr-only">
        {rows.length} {cfg.nounPlural} shown
      </div>

      {categories.length > 1 && (
        <PillGroup label="Category" className="mb-[14px] w-fit flex-wrap">
          {categories.map((c) => (
            <Pill key={c.value} active={url.catFilter === c.value} onClick={() => setUrl({ catFilter: c.value })} className="px-3 py-1.5 text-[12.5px] font-medium">
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
              className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border px-2.5 py-[5px] text-xs text-accent"
              style={{
                background: "color-mix(in srgb, var(--accent) 13%, transparent)",
                borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
            >
              {t}{" "}
              <span aria-hidden className="text-[13px] leading-none">
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {data.status === "loading" && <p className="py-10 text-center font-mono text-[13px] text-dim">loading…</p>}

      {loaded && rows.length > 0 && layout === "table" && (
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
          onLoadAll={() => setShowAllLedger(true)}
        />
      )}
      {loaded && rows.length > 0 && layout === "cards" && <ItemCards rows={rows} />}

      {loaded && items.length === 0 && (
        <div className="px-5 py-[70px] text-center">
          <div className="mb-2 text-[17px] font-semibold text-text2">{cfg.emptyTitle}</div>
          <div className="mb-[22px] text-[13px] text-dim">{cfg.emptySub}</div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={openAdd} className={accentButton + " px-[18px] py-2.5 text-[13px] font-bold"}>
              + Add a {cfg.noun}
            </button>
            <button
              type="button"
              onClick={() => actions?.loadStarter()}
              className="cursor-pointer rounded-[9px] border border-wf bg-topchip px-[18px] py-2.5 text-[13px] font-semibold text-muted"
            >
              Load starter set
            </button>
          </div>
        </div>
      )}
      {loaded && items.length > 0 && rows.length === 0 && (
        <div className="px-5 py-[70px] text-center text-dim">
          <div className="mb-1.5 text-[15px]">No {cfg.nounPlural} match.</div>
          <div className="text-[13px]">
            Try clearing filters or{" "}
            <button type="button" onClick={openAdd} className="cursor-pointer border-none bg-transparent p-0 text-accent">
              add a new {cfg.noun}
            </button>
            .
          </div>
        </div>
      )}
    </div>
  );
}
