"use client";

// Months tab (finance): a card per month, and a drill-down with the daily
// spending calendar, the category breakdown and the month's transactions.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { CountUp } from "@/components/ui/CountUp";
import { monthCards, monthDetail, type MonthCard, type MonthDetail } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { flash } from "@/lib/motion";
import { useCollectionCtx } from "./CollectionContext";

const NEGATIVE = "var(--neg)";
const panel = "rounded-[14px] border border-wd bg-surface";
const heading = "text-[11px] font-semibold uppercase tracking-[.09em] text-dim";

/** Drill-down slides in from the right; going back slides the grid in from the left. */
const slideIn = (dx: number) => ({ "--dx": dx + "px", animation: "gslidein 260ms var(--ease-out) both" }) as CSSProperties;
/** Stagger index for .g-rise (40ms per step). */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

const onActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

export function MonthsView() {
  const { cfg, items, money: m } = useCollectionCtx();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [cameBack, setCameBack] = useState(false);
  const cards = useMemo(() => monthCards(cfg, items, m), [cfg, items, m]);
  const open = useMemo(() => (openKey ? monthDetail(cfg, items, openKey, m) : null), [cfg, items, openKey, m]);

  return (
    <div className="pt-[22px]" style={{ animation: "gfade .2s ease" }}>
      {open ? (
        <div key={"m:" + openKey} style={slideIn(8)}>
          <MonthDrill
            d={open}
            onBack={() => {
              setCameBack(true);
              setOpenKey(null);
            }}
          />
        </div>
      ) : (
        <div key="grid" style={cameBack ? slideIn(-8) : undefined}>
          <MonthGrid cards={cards} onOpen={setOpenKey} />
        </div>
      )}
    </div>
  );
}

function MonthGrid({ cards, onOpen }: { cards: MonthCard[]; onOpen(key: string): void }) {
  return (
    <div>
      <div className="mb-[18px] text-[12.5px] text-muted">A card per month — click to drill into the calendar, categories &amp; transactions.</div>
      {cards.length === 0 && (
        <div className="px-5 py-[70px] text-center text-dim">
          <div className="text-[15px]">No transactions yet.</div>
        </div>
      )}
      <div className="grid gap-[14px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {cards.map((c, i) => (
          <div
            key={c.key}
            style={rise(Math.min(i, 12))}
            role="button"
            tabIndex={0}
            aria-label={"Open " + c.label}
            onClick={() => onOpen(c.key)}
            onKeyDown={onActivate(() => onOpen(c.key))}
            className="g-rise cursor-pointer rounded-[14px] border border-wd bg-card px-[19px] py-[18px] transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] active:translate-y-0"
          >
            <div className="mb-[14px] flex items-baseline justify-between">
              <div className="text-[15.5px] font-bold tracking-[-.01em]">{c.label}</div>
              <div className="font-mono text-[11px] text-dim">{c.txns} txns</div>
            </div>
            <div className="mb-[14px] grid grid-cols-2 gap-x-[14px] gap-y-3">
              <CardFigure label="Spent" value={c.spent} size={c.spentSize} color={NEGATIVE} />
              <CardFigure label="Income" value={c.income} size={c.incomeSize} color="var(--accent)" />
              <CardFigure label="Saved" value={c.saved} size={c.savedSize} color={c.savedColor} />
              <div className="min-w-0">
                <div className="mb-[3px] text-[9.5px] uppercase tracking-[.08em] text-dim">Top category</div>
                <div className="truncate text-[13.5px] font-semibold text-text2">{c.topCategory}</div>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2.5 border-t border-wd pt-[11px]">
              <div className="truncate text-[11.5px] text-muted">
                <span>Biggest ·</span> {c.biggest}
              </div>
              <div className="flex-none font-mono text-xs text-text3">{c.biggestAmt}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardFigure({ label, value, size, color }: { label: string; value: string; size: string; color: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-[3px] text-[9.5px] uppercase tracking-[.08em] text-dim">{label}</div>
      <div className="truncate font-mono font-semibold tracking-[-.02em]" style={{ fontSize: size, color }}>
        {value}
      </div>
    </div>
  );
}

function MonthDrill({ d, onBack }: { d: MonthDetail; onBack(): void }) {
  const { isMobile, openEdit, items, cfg } = useCollectionCtx();
  const edit = (id: string) => {
    const item = items.find((x) => x.id === id);
    if (item) openEdit(item);
  };

  // A transaction edited from here flashes once (more than a few changes at once is a sync, not an edit).
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const prevItems = useRef<Map<string, Item> | null>(null);
  useLayoutEffect(() => {
    const prev = prevItems.current;
    prevItems.current = new Map(items.map((x) => [x.id, x]));
    if (!prev) return;
    const changed = items.filter((x) => prev.has(x.id) && prev.get(x.id) !== x);
    if (changed.length > 3) return;
    changed.forEach((x) => flash(rowEls.current.get(x.id)?.querySelector("[data-flash]")));
  }, [items]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-[14px]">
        <button type="button" onClick={onBack} className="cursor-pointer rounded-lg border border-we bg-topchip px-3 py-[7px] text-[12.5px] text-muted transition-[color,border-color,transform] duration-200 hover:border-wi hover:text-text active:translate-y-px">
          ← All months
        </button>
        <div className="text-[22px] font-bold tracking-[-.02em]">{d.label}</div>
      </div>

      <div className="mb-[22px] grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <SummaryCard i={0} label="Spent" value={d.spent} size={d.spentSize} color={NEGATIVE} />
        <SummaryCard i={1} label="Income" value={d.income} size={d.incomeSize} color="var(--accent)" />
        <SummaryCard i={2} label="Saved" value={d.saved} size={d.savedSize} color={d.savedColor} />
        <SummaryCard i={3} label="Transactions" value={d.txnCount} size="24px" color="var(--text)" />
      </div>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.05fr .95fr" }}>
        <div className="flex flex-col gap-5">
          <div className={panel + " px-[22px] py-5"}>
            <div className={heading + " mb-4"}>Daily spending</div>
            <div className="mb-2 grid grid-cols-7 gap-1.5">
              {d.weekLabels.map((w, i) => (
                <div key={i} className="text-center font-mono text-[10px] text-dim">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {d.cells.map((c, i) =>
                c.blank ? (
                  <div key={i} className="aspect-square" />
                ) : (
                  <div
                    key={i}
                    title={c.tip || undefined}
                    className="flex aspect-square items-start justify-end rounded-md px-[5px] py-1"
                    // Week by week: every cell in a row shares its row's delay.
                    style={{ background: c.color, animation: `grise 280ms var(--ease-out) ${Math.floor(i / 7) * 30}ms both` }}
                  >
                    <span className="font-mono text-[9.5px]" style={{ color: c.has ? "var(--text2)" : "var(--dim)" }}>
                      {c.day}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className={panel + " px-[22px] py-5"}>
            <div className={heading + " mb-4"}>By category</div>
            <div className="flex flex-col gap-[9px]">
              {d.categories.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 flex-none truncate text-[12.5px]">{c.label}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-wc">
                    <div className="g-grow-x h-full rounded bg-accent" style={{ width: c.pct, "--i": Math.min(i, 10) } as CSSProperties} />
                  </div>
                  <div className="w-16 text-right font-mono text-xs font-semibold text-text2">{c.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={panel + " px-5 py-[18px]"}>
          <div className={heading + " mb-[14px]"}>Transactions</div>
          <div className="flex flex-col">
            {d.txns.map((t, i) => (
              <div
                key={t.id}
                ref={(el) => {
                  if (el) rowEls.current.set(t.id, el);
                  else rowEls.current.delete(t.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={"Edit " + (t.title || cfg.noun)}
                onClick={() => edit(t.id)}
                onKeyDown={onActivate(() => edit(t.id))}
                // The first dozen fade in 20ms apart (.g-rise steps 40ms per --i).
                className={
                  "relative isolate flex cursor-pointer items-center gap-3 overflow-hidden rounded-md border-b border-wc px-1.5 py-[9px] transition-colors duration-150 hover:bg-wa" +
                  (i < 12 ? " g-rise" : "")
                }
                style={i < 12 ? rise(i / 2) : undefined}
              >
                <span data-flash aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-accent/10 opacity-0" />
                <div className="w-12 flex-none font-mono text-[11px] text-dim">{t.date}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{t.title}</div>
                  <div className="text-[11px] text-muted">{t.category}</div>
                </div>
                <div className="flex-none font-mono text-[13px] font-semibold" style={{ color: t.color }}>
                  {t.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ i, label, value, size, color }: { i: number; label: string; value: string | number; size: string; color: string }) {
  return (
    <div className="g-rise min-w-0 rounded-xl border border-wd bg-card px-4 py-[15px]" style={rise(i)}>
      <div className="truncate font-mono font-semibold tracking-[-.02em]" style={{ fontSize: size, color }}>
        <CountUp value={value} />
      </div>
      <div className="mt-[3px] text-[11px] text-muted">{label}</div>
    </div>
  );
}
