"use client";

// Card grid layout of the library. Clicking a card opens it for editing.
import { scoreColor, statusMeta } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";

const GRID = { gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" };

export function ItemCards({ rows }: { rows: Item[] }) {
  const { cfg, openEdit } = useCollectionCtx();
  const titleKey = cfg.modal.titleField;
  const scoreKey = cfg.fields.score;
  const hoursKey = cfg.fields.hours;
  const hoursUnit = cfg.table.columns.find((c) => c.key === hoursKey)?.unit ?? "";
  // The "active" status (first one, e.g. playing) gets an accent outline.
  const activeStatus = cfg.statuses[0]?.value;

  return (
    <div className="grid gap-3" style={GRID}>
      {rows.map((g) => {
        const sm = statusMeta(cfg, g[cfg.statusField]);
        const active = g[cfg.statusField] === activeStatus;
        const score = g[scoreKey];
        const hours = g[hoursKey];
        const title = String(g[titleKey] ?? "");
        return (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            aria-label={"Edit " + (title || "item")}
            onClick={() => openEdit(g)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openEdit(g);
              }
            }}
            // Only the active status gets a visible outline; the rest rely on the card fill.
            className={
              "flex cursor-pointer flex-col rounded-xl border bg-card p-[15px] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px active:translate-y-0 " +
              (active ? "" : "border-transparent hover:border-wg")
            }
            style={
              active
                ? { borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent)" }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="text-[14.5px] leading-[1.3] font-semibold tracking-[-.01em]">{title}</div>
              <div className="flex-none font-mono text-[15px] font-semibold tabular-nums" style={{ color: scoreColor(score) }}>
                {score == null ? "—" : String(score)}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-[5px]">
              {((g[cfg.tagField] as string[]) || []).map((t, i) => (
                <span key={i} className="rounded-[5px] bg-chip px-[7px] py-[2px] text-[10.5px] text-muted2">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2 pt-3 text-[11.5px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.dot, boxShadow: sm.glow }} />
              <span style={{ color: sm.text }}>{sm.label}</span>
              <span className="flex-1" />
              <span className="font-mono text-muted tabular-nums">{hours == null ? "—" : String(hours) + hoursUnit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Placeholder cards while the library loads. */
export function ItemCardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid gap-3" style={GRID}>
      <span className="sr-only">loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden className="h-[112px] rounded-xl bg-card p-[15px] motion-safe:animate-pulse" style={{ animationDelay: i * 70 + "ms" }}>
          <div className="h-3 rounded-[4px] bg-wd" style={{ width: 50 + ((i * 29) % 35) + "%" }} />
          <div className="mt-3 flex gap-[5px]">
            <div className="h-3.5 w-12 rounded-[5px] bg-wb" />
            <div className="h-3.5 w-9 rounded-[5px] bg-wb" />
          </div>
          <div className="mt-6 h-2.5 w-20 rounded-[4px] bg-wb" />
        </div>
      ))}
    </div>
  );
}
