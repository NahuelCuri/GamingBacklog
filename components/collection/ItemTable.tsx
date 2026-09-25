"use client";

// Library table: sortable header, collapsible rows with a detail panel
// (review, actions, metadata, search links), paging and the ledger cap.
import { cellValue, cornerLink, detailRows, reviewOf, type LibraryFilters, type VisibleRows } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
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

const NEG = "#d98f8f";

export function ItemTable({ view, sort, onSort, expandedId, onToggle, pendingDelete, onDelete, onTag, onMore, onLoadAll }: Props) {
  const { cfg, isMobile, money, openEdit, openShare } = useCollectionCtx();
  const cols = cfg.table.columns;
  const visible = cols.filter((c) => !(isMobile && c.hideMobile));
  const chevron = isMobile && cfg.table.chevron.mobileWidth ? cfg.table.chevron.mobileWidth : cfg.table.chevron.width;
  const gridCols = [...visible.map((c) => (isMobile && c.mobileWidth ? c.mobileWidth : c.width)), chevron].join(" ");

  return (
    <div>
      <div
        className="grid px-3 pb-[9px] text-[10px] font-semibold tracking-[.09em] text-dim uppercase"
        style={{ gridTemplateColumns: gridCols }}
      >
        {visible.map((c) => {
          const active = sort.sortKey === c.key;
          const arrow = active ? (sort.sortDir === "asc" ? "↑" : "↓") : "";
          const style = { textAlign: c.right ? ("right" as const) : ("left" as const), paddingRight: c.right ? 20 : 0 };
          if (!c.sortable) return <div key={c.key} style={style}>{c.label}</div>;
          const label = !active ? "Sort by " + c.label : `Sorted by ${c.label}, ${sort.sortDir === "asc" ? "ascending" : "descending"} — reverse`;
          return (
            <div key={c.key} style={style}>
              <button
                type="button"
                onClick={() => onSort(c.key)}
                aria-label={label}
                className="cursor-pointer border-none bg-transparent p-0 uppercase [font:inherit] [letter-spacing:inherit]"
                style={{ color: active ? "var(--accent)" : "var(--dim)" }}
              >
                {c.label} {arrow}
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
          <div key={g.id} className="mb-[2px] overflow-hidden rounded-[9px]" style={{ background: open ? "var(--wa)" : "transparent" }}>
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
              className="grid cursor-pointer items-center border-b border-wc px-3"
              style={{ gridTemplateColumns: gridCols, paddingTop: "var(--rowpad)", paddingBottom: "var(--rowpad)" }}
            >
              {visible.map((c) => {
                const cell = cellValue(cfg, c, g, money);
                return (
                  <div key={c.key} className="min-w-0 overflow-hidden">
                    {cell.kind === "title" && <div className="truncate pr-2.5 font-medium tracking-[-.01em]">{cell.text}</div>}
                    {cell.kind === "tags" && (
                      <div className="flex max-h-6 flex-wrap gap-[5px] overflow-hidden pr-2.5">
                        {cell.tags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-label={"Filter by tag " + t}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTag(t);
                            }}
                            className="cursor-pointer rounded-[5px] border-none bg-chip px-[7px] py-[2px] text-[11px] whitespace-nowrap text-muted2"
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
              <div aria-hidden className="text-center text-[13px] text-dim transition-transform duration-250" style={{ transform: open ? "rotate(90deg)" : "none" }}>
                ›
              </div>
            </div>

            <div className="grid transition-[grid-template-rows] duration-[280ms] ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
              <div className="overflow-hidden" inert={!open}>
                  <div className="relative grid gap-[26px] px-[14px] pt-4 pb-5" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr" }}>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold tracking-[.09em] text-dim uppercase">{cfg.reviewLabel}</div>
                      <div className="text-[13px] leading-[1.65]" style={{ color: review ? "var(--text3)" : "var(--dim)", fontStyle: review ? "italic" : "normal" }}>
                        {review ?? cfg.reviewEmpty}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => openEdit(g)} className="cursor-pointer rounded-[7px] border-none bg-accent px-[14px] py-[7px] text-xs font-semibold text-on-accent">
                          Edit
                        </button>
                        <button type="button" onClick={() => openShare(g)} className="cursor-pointer rounded-[7px] border border-wf bg-chip px-[14px] py-[7px] text-xs font-semibold text-text2">
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(g)}
                          className="cursor-pointer rounded-[7px] border px-[14px] py-[7px] text-xs font-semibold"
                          style={{
                            color: confirming ? "var(--onAccent)" : NEG,
                            background: confirming ? NEG : "transparent",
                            borderColor: confirming ? NEG : "rgba(217,143,143,.4)",
                          }}
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
                                <GlobeIcon />
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
                        className="absolute right-[14px] bottom-[14px] rounded-md border px-[9px] py-1 text-[10px] font-medium whitespace-nowrap"
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
          className="mt-2 w-full cursor-pointer rounded-[9px] border border-dashed border-wj bg-transparent p-3 font-mono text-[12.5px] text-muted tabular-nums"
        >
          Showing {view.more.shown} of {view.more.total} · load {view.more.remaining} more
        </button>
      )}
      {view.ledger.limited && (
        <button
          type="button"
          onClick={onLoadAll}
          className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-dashed border-wj bg-transparent p-[13px] font-mono text-[12.5px] text-muted"
        >
          Showing {view.ledger.label} · <span className="text-accent">Load all {view.ledger.total} {cfg.nounPlural}</span>{" "}
          <span className="text-dim">({view.ledger.hidden} more)</span> →
        </button>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
  );
}
