"use client";

// Themed date picker (legacy DatePicker): day grid with keyboard navigation,
// month and year views, Clear and Today. Value is an ISO YYYY-MM-DD string.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type View = "days" | "months" | "years";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parse(v: string | undefined | null) {
  const m = typeof v === "string" ? v.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
}
const dateOf = (iso: string | null) => {
  const p = parse(iso);
  return p ? new Date(p.y, p.mo, p.d) : new Date();
};

const ACC = "var(--accent)";
const HOVER = "color-mix(in srgb, var(--accent) 16%, transparent)";

export function DatePicker({ value, onChange, placeholder = "Select a date" }: { value: string; onChange(iso: string): void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [vy, setVy] = useState(0);
  const [vm, setVm] = useState(0);
  const [focusIso, setFocusIso] = useState<string | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusPending = useRef(false);

  const fmt = useMemo(
    () => ({
      long: new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }),
      full: new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      monthYear: new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }),
      monthShort: new Intl.DateTimeFormat(undefined, { month: "short" }),
      wdShort: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
      wdLong: new Intl.DateTimeFormat(undefined, { weekday: "long" }),
    }),
    [],
  );

  const p = parse(value);
  const label = p ? fmt.long.format(new Date(p.y, p.mo, p.d)) : placeholder;

  useEffect(() => {
    if (!open || !focusPending.current) return;
    focusPending.current = false;
    pop.current?.querySelector<HTMLElement>(`[data-iso="${focusIso}"]`)?.focus();
  }, [open, focusIso, vy, vm]);

  const toggle = () => {
    if (open) return close();
    const t = new Date();
    setVy(p ? p.y : t.getFullYear());
    setVm(p ? p.mo : t.getMonth());
    setView("days");
    setFocusIso(p ? value : isoOf(t));
    focusPending.current = true;
    setOpen(true);
  };
  const close = (restore = true) => {
    setOpen(false);
    setView("days");
    if (restore) trigger.current?.focus();
  };
  const pick = (iso: string) => {
    onChange(iso);
    close();
  };

  const step = (dir: 1 | -1) => {
    if (view === "days") {
      const d = new Date(vy, vm + dir, 1);
      setVy(d.getFullYear());
      setVm(d.getMonth());
    } else setVy((y) => y + dir * (view === "months" ? 1 : 12));
  };

  const moveFocus = (days: number, months = 0) => {
    const base = dateOf(focusIso);
    if (months) base.setMonth(base.getMonth() + months);
    if (days) base.setDate(base.getDate() + days);
    setFocusIso(isoOf(base));
    setVy(base.getFullYear());
    setVm(base.getMonth());
    focusPending.current = true;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (view !== "days") return;
    const d = dateOf(focusIso);
    const keys: Record<string, () => void> = {
      ArrowLeft: () => moveFocus(-1),
      ArrowRight: () => moveFocus(1),
      ArrowUp: () => moveFocus(-7),
      ArrowDown: () => moveFocus(7),
      PageUp: () => moveFocus(0, -1),
      PageDown: () => moveFocus(0, 1),
      Home: () => moveFocus(1 - d.getDate()),
      End: () => moveFocus(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate()),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  const today = isoOf(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 8, 1 + i); // Sun Sep 1 2024 → Sun..Sat
    return { short: fmt.wdShort.format(d), full: fmt.wdLong.format(d) };
  });
  const headerLabel =
    view === "days" ? fmt.monthYear.format(new Date(vy, vm, 1)) : view === "months" ? String(vy) : `${vy - (vy % 12)} – ${vy - (vy % 12) + 11}`;
  const unit = view === "days" ? "month" : view === "months" ? "year" : "12 years";
  const nextView: View = view === "days" ? "months" : view === "months" ? "years" : "days";

  const cellButton = (key: string | number, text: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex h-[46px] cursor-pointer items-center justify-center rounded-[9px] border-none font-mono text-[13px] transition-[background] duration-[120ms]"
      style={{ color: active ? "var(--bg)" : "var(--text)", background: active ? ACC : "transparent" }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.background = HOVER)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      {text}
    </button>
  );

  return (
    <div className="relative w-full">
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${placeholder}: ${p ? label : "none selected"}`}
        className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-[9px] border bg-inset px-3 py-2.5 font-mono text-sm select-none transition-[border-color] duration-150 hover:border-[color-mix(in_srgb,var(--accent)_55%,var(--wh))]"
        style={{ color: p ? "var(--text)" : "var(--dim)", borderColor: open ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "var(--wh)" }}
      >
        <span>{label}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className="flex-none">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <>
          <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-(--z-popover)" />
          <div
            ref={pop}
            role="dialog"
            aria-modal="false"
            aria-label="Choose a date"
            onKeyDown={onKey}
            className="absolute top-[calc(100%+8px)] left-0 z-(--z-popover) w-[280px] max-w-[calc(100vw-40px)] rounded-[13px] border border-wi bg-card p-[14px] overscroll-contain"
            style={{ boxShadow: "var(--shadow-pop)", animation: "dpop .14s ease" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <ArrowButton dir="prev" label={"Previous " + unit} onClick={() => step(-1)} />
              <button
                type="button"
                onClick={() => setView(nextView)}
                aria-label={`${headerLabel} — switch to ${view === "days" ? "month" : view === "months" ? "year" : "day"} view`}
                className="cursor-pointer rounded-lg border-none bg-transparent px-2.5 py-1 text-sm font-bold tracking-[.01em] text-text hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
              >
                {headerLabel}
              </button>
              <ArrowButton dir="next" label={"Next " + unit} onClick={() => step(1)} />
            </div>

            {view === "days" && (
              <div role="grid" aria-label={headerLabel}>
                <div role="row" className="mb-1 grid grid-cols-7 gap-[2px]">
                  {weekdays.map((w) => (
                    <div key={w.full} role="columnheader" aria-label={w.full} className="py-1 text-center text-[10px] font-semibold tracking-[.05em] text-dim uppercase">
                      {w.short}
                    </div>
                  ))}
                </div>
                {Array.from({ length: 6 }, (_, w) => {
                  const firstDow = new Date(vy, vm, 1).getDay();
                  return (
                    <div key={w} role="row" className="mb-[2px] grid grid-cols-7 gap-[2px]">
                      {Array.from({ length: 7 }, (_, i) => {
                        const dt = new Date(vy, vm, w * 7 + i - firstDow + 1);
                        const iso = isoOf(dt);
                        const selected = !!p && iso === value;
                        const isToday = iso === today;
                        const other = dt.getMonth() !== vm;
                        return (
                          <button
                            key={iso}
                            type="button"
                            role="gridcell"
                            data-iso={iso}
                            tabIndex={iso === focusIso ? 0 : -1}
                            aria-selected={selected}
                            aria-current={isToday ? "date" : undefined}
                            aria-label={fmt.full.format(dt)}
                            onClick={() => pick(iso)}
                            className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border font-mono text-[13px] transition-[background] duration-[120ms]"
                            style={{
                              color: selected ? "var(--bg)" : other ? "var(--dim)" : "var(--text)",
                              background: selected ? ACC : "transparent",
                              borderColor: isToday && !selected ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "transparent",
                            }}
                            onMouseEnter={(e) => !selected && (e.currentTarget.style.background = HOVER)}
                            onMouseLeave={(e) => !selected && (e.currentTarget.style.background = "transparent")}
                          >
                            {dt.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            {view === "months" && (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) =>
                  cellButton(i, fmt.monthShort.format(new Date(vy, i, 1)), !!p && p.y === vy && p.mo === i, () => {
                    setVm(i);
                    setView("days");
                  }),
                )}
              </div>
            )}
            {view === "years" && (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const y = vy - (vy % 12) + i;
                  return cellButton(y, String(y), !!p && p.y === y, () => {
                    setVy(y);
                    setView("months");
                  });
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-we pt-[11px]">
              <button type="button" onClick={() => pick("")} className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-muted">
                Clear
              </button>
              <button type="button" onClick={() => pick(isoOf(new Date()))} className="cursor-pointer border-none bg-transparent p-0 text-xs font-bold text-accent">
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ArrowButton({ dir, label, onClick }: { dir: "prev" | "next"; label: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border-none bg-chip text-text2 hover:bg-[color-mix(in_srgb,var(--accent)_18%,var(--chip))]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
