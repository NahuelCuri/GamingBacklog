"use client";

// Card grid layout of the library. Clicking a card opens it for editing.
import { scoreColor, statusMeta } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "./CollectionContext";

export function ItemCards({ rows }: { rows: Item[] }) {
  const { cfg, openEdit } = useCollectionCtx();
  const titleKey = cfg.modal.titleField;
  const scoreKey = cfg.fields.score;
  const hoursKey = cfg.fields.hours;
  const hoursUnit = cfg.table.columns.find((c) => c.key === hoursKey)?.unit ?? "";
  // The "active" status (first one, e.g. playing) gets an accent outline.
  const activeStatus = cfg.statuses[0]?.value;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
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
            className="cursor-pointer rounded-xl border bg-card p-[15px]"
            style={{
              borderColor: active ? "color-mix(in srgb, var(--accent) 28%, transparent)" : "var(--wd)",
              boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
            }}
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
            <div className="mt-3 flex items-center gap-2 text-[11.5px]">
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
