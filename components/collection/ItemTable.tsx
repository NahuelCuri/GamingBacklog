"use client";

// Library table: sortable header, collapsible rows with a detail panel
// (review, actions, metadata, search links), paging and the ledger cap.
import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon, GlobeIcon } from "@/components/icons";
import { cellValue, cornerLink, detailRows, reviewOf, type LibraryFilters, type VisibleRows } from "@/lib/collection";
import type { CollectionConfig, Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";

interface Props {
  view: VisibleRows;
  sort: Pick<LibraryFilters, "sortKey" | "sortDir">;
  onSort(key: string): void;
  expandedId: string | null;
  onToggle(id: string): void;
  pendingDelete: string | null;
  onDelete(item: Item): void;
  onTag(tag: string): void;
  onMore(): void;
  onLoadAll(): void;
}

/** Grid template for the header, rows and skeleton: visible columns plus the chevron. */
function tableGrid(cfg: CollectionConfig, isMobile: boolean) {
  const visible = cfg.table.columns.filter((c) => !(isMobile && c.hideMobile));
  const chevron = isMobile && cfg.table.chevron.mobileWidth ? cfg.table.chevron.mobileWidth : cfg.table.chevron.width;
  return { visible, gridCols: [...visible.map((c) => (isMobile && c.mobileWidth ? c.mobileWidth : c.width)), chevron].join(" ") };
}

const smallButton =
  "cursor-pointer rounded-[7px] px-[14px] py-[7px] text-xs font-semibold transition-[color,background-color,border-color,filter,transform] duration-200 active:translate-y-px";
const moreButton =
  "w-full cursor-pointer rounded-[9px] border border-dashed border-wj bg-transparent font-mono text-[12.5px] text-muted transition-[color,border-color,background-color] duration-200 hover:border-wl hover:bg-wa hover:text-text";

export function ItemTable({ view, sort, onSort, expandedId, onToggle, pendingDelete, onDelete, onTag, onMore, onLoadAll }: Props) {
  const { cfg, isMobile, money, openEdit, openShare } = useCollectionCtx();
  const { visible, gridCols } = tableGrid(cfg, isMobile);

  return (
    <div>
      <div
        className="grid px-3 pb-[9px] text-[10px] font-semibold tracking-[.09em] text-dim uppercase"
        style={{ gridTemplateColumns: gridCols }}
      >
        {visible.map((c) => {
          const active = sort.sortKey === c.key;
          const Arrow = sort.sortDir === "asc" ? ArrowUpIcon : ArrowDownIcon;
          const style = { textAlign: c.right ? ("right" as const) : ("left" as const), paddingRight: c.right ? 20 : 0 };
          if (!c.sortable) return <div key={c.key} style={style}>{c.label}</div>;
          const label = !active ? "Sort by " + c.label : `Sorted by ${c.label}, ${sort.sortDir === "asc" ? "ascending" : "descending"} — reverse`;
          return (
            <div key={c.key} style={style}>
              <button
                type="button"
                onClick={() => onSort(c.key)}
                aria-label={label}
                className={
                  "inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 uppercase transition-colors duration-200 [font:inherit] [letter-spacing:inherit] " +
                  (active ? "text-accent" : "text-dim hover:text-text2")
                }
              >
                {c.label}
                {active && <Arrow size={10} />}
              </button>
            </div>
          );
        })}
        <div />
      </div>

      {view.rows.map((g) => {
        const open = expandedId === g.id;
        const confirming = pendingDelete === g.id;
        const review = reviewOf(cfg, g);
        const corner = cornerLink(cfg, g);
        const title = String(g[cfg.modal.titleField] || g.title || "Row");
        return (
          <div key={g.id} className={"mb-[2px] overflow-hidden rounded-[9px] transition-colors duration-200 " + (open ? "bg-wa" : "")}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={open}
              aria-label={`${title} — ${open ? "collapse" : "expand"} details`}
              onClick={() => onToggle(g.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(g.id);
                }
              }}
              className="group grid cursor-pointer items-center border-b border-wc px-3 transition-colors duration-150 hover:bg-wa"
              style={{ gridTemplateColumns: gridCols, paddingTop: "var(--rowpad)", paddingBottom: "var(--rowpad)" }}
            >
              {visible.map((c) => {
                const cell = cellValue(cfg, c, g, money);
                return (
                  <div key={c.key} className="min-w-0 overflow-hidden">
                    {cell.kind === "title" && <div className="truncate pr-2.5 font-medium tracking-[-.01em]">{cell.text}</div>}
                    {cell.kind === "tags" && (
                      <div className="flex max-h-6 flex-wrap gap-[5px] overflow-hidden pr-2.5">
                        {cell.tags.map((t, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={"Filter by tag " + t}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTag(t);
                            }}
                            className="cursor-pointer rounded-[5px] border-none bg-chip px-[7px] py-[2px] text-[11px] whitespace-nowrap text-muted2 transition-colors duration-150 hover:text-accent"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                    {cell.kind === "status" && (
                      <div className="flex items-center gap-[7px]">
                        <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: cell.meta.dot, boxShadow: cell.meta.glow }} />
                        <span className="text-xs" style={{ color: cell.meta.text }}>
                          {cell.meta.label}
                        </span>
                      </div>
                    )}
                    {cell.kind === "value" && (
                      <div
                        className="font-mono"
                        style={{
                          textAlign: c.right ? "right" : "left",
                          fontSize: cell.strong ? 13 : 12.5,
                          fontWeight: cell.strong ? 600 : 400,
                          color: cell.color,
                          paddingRight: c.kind === "money" ? 0 : c.kind === "score" ? (c.right ? 14 : 0) : c.right ? 20 : 0,
                        }}
                      >
                        {cell.text}
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                aria-hidden
                className="flex justify-center text-dim transition-[transform,color] duration-250 group-hover:text-text2"
                style={{ transform: open ? "rotate(90deg)" : "none" }}
              >
                <CaretRightIcon size={12} />
              </div>
            </div>

            <div className="grid transition-[grid-template-rows] duration-[280ms] ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
              <div className="overflow-hidden" inert={!open}>
                  <div className="relative grid gap-[26px] px-[14px] pt-4 pb-5" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr" }}>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold tracking-[.09em] text-dim uppercase">{cfg.reviewLabel}</div>
                      <div className="max-w-[68ch] text-[13px] leading-[1.65] text-pretty" style={{ color: review ? "var(--text3)" : "var(--dim)", fontStyle: review ? "italic" : "normal" }}>
                        {review ?? cfg.reviewEmpty}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => openEdit(g)} className={smallButton + " border-none bg-accent text-on-accent hover:brightness-110"}>
                          Edit
                        </button>
                        <button type="button" onClick={() => openShare(g)} className={smallButton + " border border-wf bg-chip text-text2 hover:border-wi hover:text-text"}>
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(g)}
                          className={
                            smallButton +
                            " border " +
                            (confirming
                              ? "border-neg bg-neg text-on-accent hover:brightness-110"
                              : "border-neg/40 bg-transparent text-neg hover:border-neg hover:bg-neg/10")
                          }
                        >
                          {confirming ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    </div>
                    <div className="grid content-start gap-x-4 gap-y-[13px] font-mono" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      {detailRows(cfg, g, money).map((f) => (
                        <div key={f.label}>
                          <div className="mb-1 flex items-center gap-[5px]">
                            <span className="text-[9.5px] tracking-[.08em] text-dim uppercase">{f.label}</span>
                            {f.link && (
                              <a
                                href={f.link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.link.title}
                                aria-label={f.link.title}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center leading-none"
                                style={{ color: f.link.pulse ? "var(--accent)" : "var(--dim)", animation: f.link.pulse ? "gpulse 1.6s ease-in-out infinite" : "none" }}
                              >
                                <GlobeIcon size={11} />
                              </a>
                            )}
                          </div>
                          <div className="text-[12.5px] text-text2">{f.value}</div>
                        </div>
                      ))}
                    </div>
                    {corner && (
                      <a
                        href={corner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={
                          "rounded-md border px-[9px] py-1 text-[10px] font-medium whitespace-nowrap transition-colors duration-200 hover:text-text " +
                          // In the single-column mobile layout it sits in the flow instead of over the metadata.
                          (isMobile ? "justify-self-start" : "absolute right-[14px] bottom-[14px]")
                        }
                        style={{
                          color: corner.pulse ? "var(--accent)" : "var(--muted)",
                          borderColor: corner.pulse ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--wh)",
                          animation: corner.pulse ? "gpulsebtn 1.6s ease-in-out infinite" : "none",
                        }}
                      >
                        {corner.label}
                      </a>
                    )}
                  </div>
              </div>
            </div>
          </div>
        );
      })}

      {view.more.show && (
        <button
          type="button"
          onClick={onMore}
          className={moreButton + " mt-2 p-3 tabular-nums"}
        >
          Showing {view.more.shown} of {view.more.total} · load {view.more.remaining} more
        </button>
      )}
      {view.ledger.limited && (
        <button
          type="button"
          onClick={onLoadAll}
          className={moreButton + " mt-1.5 flex items-center justify-center gap-2 p-[13px]"}
        >
          Showing {view.ledger.label} · <span className="text-accent">Load all {view.ledger.total} {cfg.nounPlural}</span>{" "}
          <span className="text-dim">({view.ledger.hidden} more)</span> →
        </button>
      )}
    </div>
  );
}

/** Placeholder rows in the table's own grid while the library loads. */
export function ItemTableSkeleton({ rows = 9 }: { rows?: number }) {
  const { cfg, isMobile } = useCollectionCtx();
  const { visible, gridCols } = tableGrid(cfg, isMobile);
  return (
    <div aria-busy="true">
      <span className="sr-only">loading…</span>
      <div aria-hidden className="grid px-3 pb-[9px]" style={{ gridTemplateColumns: gridCols }}>
        {visible.map((c) => (
          <div key={c.key} className="flex h-[13px] items-center" style={{ justifyContent: c.right ? "flex-end" : "flex-start", paddingRight: c.right ? 20 : 0 }}>
            <div className="h-2 w-10 rounded-sm bg-wb" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          aria-hidden
          className="mb-[2px] grid items-center border-b border-wc px-3 py-[11px] motion-safe:animate-pulse"
          style={{ gridTemplateColumns: gridCols, animationDelay: r * 70 + "ms" }}
        >
          {visible.map((c, i) => (
            <div key={c.key} className="flex pr-2.5" style={{ justifyContent: c.right ? "flex-end" : "flex-start" }}>
              <div
                className="h-2.5 rounded-[4px] bg-wd"
                // Titles vary in length like real data; other cells stay short.
                style={{ width: i === 0 ? 48 + ((r * 37) % 40) + "%" : c.right ? 28 : "55%" }}
              />
            </div>
          ))}
          <div />
        </div>
      ))}
    </div>
  );
}
