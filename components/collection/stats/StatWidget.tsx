"use client";

// One stats card. Data comes from lib/collection/stats; presentation options
// (colours, widths, compact) are read from the widget's spec, as in legacy.
import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/ui/CountUp";
import type { BarRow, PodiumEntry, Widget } from "@/lib/collection";
import type { WidgetSpec } from "@/lib/collection/types";

const ACC = "var(--accent)";
const mono = "font-mono";

function Card({ title, children, right, mb = 16 }: { title: string; children: ReactNode; right?: ReactNode; mb?: number }) {
  return (
    <section className="rounded-[14px] border border-wd bg-surface px-[22px] py-5">
      <div className="flex items-center justify-between" style={{ marginBottom: mb }}>
        <h3 className="m-0 text-[11px] font-semibold tracking-[.09em] text-dim uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

interface BarStyle {
  rowGap: string;
  cellGap: string;
  labelWidth: string;
  labelSize: string;
  barColor: string;
  barOpacity: string;
  valWidth: string;
  valColor: string;
  valSize: string;
  valWeight: number;
}

/** Legacy barListWidget / barBag presentation for each bar-style widget kind. */
function barStyle(spec: WidgetSpec): BarStyle {
  const base = { cellGap: "12px", labelSize: "12.5px", valColor: spec.valColor || "var(--text2)", valSize: "12px", valWeight: 600 };
  switch (spec.kind) {
    case "barList": {
      const c = !!spec.compact;
      return {
        ...base,
        rowGap: c ? "10px" : "9px",
        cellGap: c ? "11px" : "12px",
        labelWidth: c ? "96px" : spec.podium ? "150px" : "170px",
        labelSize: c ? "12px" : "12.5px",
        barColor: spec.barColor || ACC,
        barOpacity: spec.barOpacity || "1",
        valWidth: spec.podium ? "26px" : c ? "22px" : spec.money2 ? "96px" : "44px",
        valSize: c ? "11.5px" : "12px",
        valWeight: c ? 400 : 600,
      };
    }
    case "tagRating":
      return { ...base, rowGap: "9px", labelWidth: spec.labelWidth || "140px", barColor: spec.barColor || ACC, barOpacity: spec.barOpacity || ".9", valWidth: "46px" };
    case "sumBars":
      return { ...base, rowGap: "9px", labelWidth: spec.labelWidth || "120px", barColor: spec.barColor || ACC, barOpacity: "1", valWidth: "96px" };
    case "weekday":
      return { ...base, rowGap: "9px", labelWidth: "52px", barColor: spec.barColor || ACC, barOpacity: "1", valWidth: "96px" };
    default:
      return { ...base, rowGap: "9px", labelWidth: "120px", barColor: ACC, barOpacity: "1", valWidth: "96px" };
  }
}

export function BarRows({ rows, showRank, s }: { rows: BarRow[]; showRank: boolean; s: BarStyle }) {
  return (
    <div className="flex flex-col" style={{ gap: s.rowGap }}>
      {rows.map((t, i) => (
        <div key={i} className="flex items-center" style={{ gap: s.cellGap }}>
          {showRank && <div className={mono + " w-5 flex-none text-[11px] text-dim"}>{t.rank}</div>}
          <div className="flex-none truncate" style={{ width: s.labelWidth, fontSize: s.labelSize }}>
            {t.label}
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded bg-wc">
            <div className="g-grow-x h-full rounded" style={{ width: t.pct, background: s.barColor, opacity: s.barOpacity, "--i": Math.min(i, 10) } as CSSProperties} />
          </div>
          <div className={mono + " text-right"} style={{ fontSize: s.valSize, fontWeight: s.valWeight, width: s.valWidth, color: s.valColor }}>
            {t.val}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Podium reveal: third and second first, then the winner rises with a slight overshoot. */
const PODIUM_DELAY: Record<number, number> = { 3: 0, 2: 90, 1: 200 };

function Podium({ entries }: { entries: PodiumEntry[] }) {
  return (
    <div className="mb-[18px] grid grid-cols-3 items-end gap-3">
      {entries.map((p) => {
        const first = p.rank === 1;
        return (
          <div
            key={p.rank}
            style={{ animation: `gpodium ${first ? 460 : 360}ms ${first ? "var(--ease-spring)" : "var(--ease-out)"} ${PODIUM_DELAY[p.rank] ?? 0}ms both` }}
          >
            <div
              className="rounded-[11px] border text-center"
              style={{
                background: first ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--chip2)",
                borderColor: first ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--wd)",
                padding: first ? "20px 14px" : "13px 12px",
                transform: `translateY(${first ? "-10px" : "0px"})`,
              }}
            >
              <div className={mono + " mb-2 text-[11px] font-semibold"} style={{ color: first ? ACC : "var(--muted)" }}>
                #{p.rank}
              </div>
              <div className={mono + " font-semibold text-accent"} style={{ fontSize: first ? 30 : 21 }}>
                <CountUp value={p.score} />
              </div>
              <div className="mt-2 leading-[1.3] font-medium" style={{ fontSize: first ? 13 : 11.5 }}>
                {p.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VBars({
  bars,
  height,
  gap,
  color,
  opacity = 1,
  labelSize = 10.5,
  minWidth,
  scroll,
}: {
  bars: { label: string | number; top: ReactNode; pct: string; color?: string }[];
  height: number;
  gap: number;
  color?: string;
  opacity?: number;
  labelSize?: number;
  minWidth?: number;
  scroll?: boolean;
}) {
  return (
    <div className={"flex items-end" + (scroll ? " g-scroll overflow-x-auto" : "")} style={{ height, gap }}>
      {bars.map((b, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[7px]" style={{ minWidth }}>
          <div className={mono + " text-muted whitespace-nowrap"} style={{ fontSize: labelSize }}>
            {b.top}
          </div>
          <div
            className="g-grow-y min-h-[3px] w-full rounded-[4px_4px_2px_2px]"
            style={{ height: b.pct, background: b.color || color, opacity, "--i": Math.min(i, 15) } as CSSProperties}
          />
          <div className={mono + " text-dim whitespace-nowrap"} style={{ fontSize: labelSize }}>
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ring sweeps in clockwise; keyed on the gradient so a new year's data sweeps again. */
function Donut({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <div className="relative flex h-[120px] w-[120px] flex-none items-center justify-center">
      <div key={bg} aria-hidden className="g-sweep absolute inset-0 rounded-full" style={{ background: bg }} />
      <div className="relative flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-surface">{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value: ReactNode }[] }) {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      {items.map((l, i) => (
        <div key={i} className="flex items-center gap-[9px]">
          <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: l.color }} />
          <span className="flex-1 text-[12.5px] text-text2">{l.label}</span>
          <span className={mono + " text-[12.5px] font-semibold"}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

const cell: CSSProperties = { width: 13, height: 13, borderRadius: 3 };
const swatch: CSSProperties = { width: 11, height: 11, borderRadius: 3 };

export function StatWidget({ w, onYear }: { w: Widget; onYear?(year: string): void }) {
  switch (w.kind) {
    case "barList": {
      const s = barStyle(w.spec);
      return (
        <Card title={w.title}>
          {w.podium.length > 0 && <Podium entries={w.podium} />}
          <BarRows rows={w.rows} showRank={w.showRank} s={s} />
        </Card>
      );
    }
    case "histogram":
      return (
        <Card title={w.title} mb={18}>
          <VBars height={130} gap={8} bars={w.bars.map((b) => ({ label: b.label, top: b.count, pct: b.pct, color: b.color }))} />
        </Card>
      );
    case "byYear":
      return (
        <Card title={w.title} mb={18}>
          <VBars height={110} gap={10} color={ACC} opacity={0.8} bars={w.bars.map((b) => ({ label: b.label, top: b.count, pct: b.pct }))} />
        </Card>
      );
    case "trend":
      return (
        <Card title={w.title} mb={18}>
          <VBars
            height={150}
            gap={6}
            color={w.spec.barColor || ACC}
            opacity={0.85}
            labelSize={9.5}
            minWidth={34}
            scroll
            bars={w.bars.map((b) => ({ label: b.label, top: b.amount, pct: b.pct }))}
          />
        </Card>
      );
    case "heatmap":
      return (
        <Card title={w.title}>
          <div className="g-scroll overflow-x-auto">
            <div className="mb-1 flex gap-[3px]">
              {w.monthCols.map((m, i) => (
                <div key={i} className={mono + " w-[13px] text-[8.5px] whitespace-nowrap text-dim"}>
                  {m}
                </div>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {w.weeks.map((wk, i) => (
                <div key={i} className="flex flex-col gap-[3px]" style={{ animation: `gfade 240ms var(--ease-out) ${i * 6}ms both` }}>
                  {wk.col.map((d) => (
                    <div key={d.title} title={d.title} style={{ ...cell, background: d.color }} />
                  ))}
                </div>
              ))}
            </div>
            <div className={mono + " mt-3 flex items-center gap-1.5 text-[9.5px] text-dim"}>
              <span>less</span>
              <div style={{ ...swatch, background: "var(--wc)" }} />
              {[30, 55, 80].map((p) => (
                <div key={p} style={{ ...swatch, background: `color-mix(in srgb, var(--accent) ${p}%, transparent)` }} />
              ))}
              <span>more</span>
            </div>
          </div>
        </Card>
      );
    case "statusDonut":
      return (
        <Card title={w.title}>
          <div className="flex items-center gap-5">
            <Donut bg={w.donut}>
              <div className={mono + " text-[22px] font-semibold text-accent"}>
                <CountUp value={w.centerValue} />
              </div>
              <div className="text-[9.5px] text-dim">{w.centerLabel}</div>
            </Donut>
            <Legend items={w.legend.map((l) => ({ color: l.color, label: l.label, value: l.count }))} />
          </div>
        </Card>
      );
    case "moneyDonut":
      return (
        <Card
          title={w.title}
          right={
            <select
              value={w.year}
              onChange={(e) => onYear?.(e.target.value)}
              aria-label={w.title + " — year"}
              className={mono + " cursor-pointer rounded-[7px] border border-wh bg-inset px-2 py-1 text-[11.5px] text-text2 transition-colors duration-200 hover:border-wk"}
            >
              {w.yearOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-inset">
                  {o.label}
                </option>
              ))}
            </select>
          }
        >
          <div className="flex items-center gap-5">
            <Donut bg={w.donut}>
              <div className={mono + " font-semibold tracking-[-.02em] whitespace-nowrap"} style={{ fontSize: w.centerSize, color: "oklch(0.8 0.09 85)" }}>
                <CountUp value={w.centerValue} />
              </div>
              <div className="text-[9.5px] text-dim">{w.centerLabel}</div>
            </Donut>
            <Legend items={w.legend.map((l) => ({ color: l.color, label: l.label, value: l.amount }))} />
          </div>
        </Card>
      );
  }
}
