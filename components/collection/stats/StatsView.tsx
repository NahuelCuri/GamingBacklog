"use client";

// Stats tab: summary cards plus the two widget columns from cfg.stats.
import { useMemo, useState, type CSSProperties } from "react";
import { CountUp } from "@/components/ui/CountUp";
import { accentButton } from "@/components/ui/Pills";
import { buildStats, suspects } from "@/lib/collection";
import { useCollectionCtx } from "../CollectionContext";
import { StatWidget } from "./StatWidget";

export function StatsView() {
  const { cfg, items, money, isMobile, openStatsImage, openEdit } = useCollectionCtx();
  const [spendYear, setSpendYear] = useState("all");
  const stats = useMemo(
    () => buildStats(cfg, items, { accent: cfg.theme.accent, spendYear, money }),
    [cfg, items, spendYear, money],
  );
  // Numbers that look like typos (1080h on a 15h game) are left out of the stats; say which.
  const odd = useMemo(() => suspects(cfg, items), [cfg, items]);
  const sp = cfg.stats.suspect;

  return (
    <div className="pt-[22px]" style={{ animation: "gfade .2s ease" }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12.5px] text-muted">Build a shareable image from any of your stats.</div>
        <button type="button" onClick={openStatsImage} className={accentButton + " px-4 py-[9px] text-[13px] font-bold"}>
          Create image ↗
        </button>
      </div>

      {sp && odd.length > 0 && (
        <div role="note" className="mb-5 rounded-xl border border-[#e0b86a]/35 bg-[#e0b86a]/8 px-4 py-3 text-[13px] leading-[1.55] text-text2">
          <div className="mb-1.5 font-semibold text-[#e0b86a]">
            {odd.length === 1 ? "1 entry looks like a typo" : `${odd.length} entries look like typos`}
          </div>
          <div className="mb-2 text-muted">
            {sp.label}, so they&apos;re left out of these stats until fixed.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {odd.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => openEdit(g)}
                className="cursor-pointer rounded-lg border border-wf bg-chip px-2.5 py-1 font-mono text-xs text-text2 hover:border-wi hover:text-text"
              >
                {String(g[cfg.modal.titleField] || g.id) + " · " + [g[sp.field], g[sp.vs]].map((v) => (v == null || v === "" ? "—" : String(v))).join(" / ")}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-[26px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {stats.summary.map((c, i) => (
          <div key={c.label} className="g-rise min-w-0 rounded-xl border border-wd bg-card px-[17px] py-4" style={{ "--i": i } as CSSProperties}>
            <div
              className="truncate font-mono font-semibold tracking-[-.02em]"
              style={{ fontSize: c.size, color: c.accent ? "var(--accent)" : "var(--text)" }}
            >
              <CountUp value={c.value} />
            </div>
            <div className="mt-1 text-[11.5px] text-pretty text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.15fr .85fr" }}>
        {[stats.left, stats.right].map((col, i) => (
          <div key={i} className="flex flex-col gap-5">
            {col.map((w) => (
              <StatWidget key={w.title} w={w} onYear={setSpendYear} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
