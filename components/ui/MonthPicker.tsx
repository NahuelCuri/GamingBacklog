"use client";

// Themed month picker: a popover with a year header and a 3×4 grid of months,
// matching DatePicker's look. Value is a "YYYY-MM" key.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MON, monthLabel } from "@/lib/collection/format";

const ACC = "var(--accent)";
const HOVER = "color-mix(in srgb, var(--accent) 16%, transparent)";

const parse = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return { y, mo: m - 1 };
};
const keyOf = (y: number, mo: number) => `${y + Math.floor(mo / 12)}-${String((((mo % 12) + 12) % 12) + 1).padStart(2, "0")}`;

/** `max` is the newest selectable month ("YYYY-MM"); later months are disabled. `large` makes the trigger a heading-sized title. */
export function MonthPicker({ value, onChange, max, large, className = "" }: { value: string; onChange(key: string): void; max: string; large?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(() => parse(value).y);
  const [focusKey, setFocusKey] = useState(value);
  const pop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusPending = useRef(false);

  const fmt = useMemo(() => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }), []);
  const sel = parse(value);
  const maxP = parse(max);

  useEffect(() => {
    if (!open || !focusPending.current) return;
    focusPending.current = false;
    pop.current?.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)?.focus();
  }, [open, focusKey, vy]);

  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  const toggle = () => {
    if (open) return close();
    setVy(sel.y);
    setFocusKey(value);
    focusPending.current = true;
    setOpen(true);
  };
  const pick = (k: string) => {
    onChange(k);
    close();
  };

  // Steps the roving focus by `n` months, following it with the year shown.
  const moveFocus = (n: number) => {
    const f = parse(focusKey);
    const k = keyOf(f.y, f.mo + n);
    if (k > max) return;
    setFocusKey(k);
    setVy(parse(k).y);
    focusPending.current = true;
  };

  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      Escape: () => close(),
      ArrowLeft: () => moveFocus(-1),
      ArrowRight: () => moveFocus(1),
      ArrowUp: () => moveFocus(-3),
      ArrowDown: () => moveFocus(3),
      PageUp: () => moveFocus(-12),
      PageDown: () => moveFocus(12),
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
    keys[e.key]();
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Month: ${monthLabel(value)}`}
        className={
          "flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-2 font-semibold tabular-nums transition-colors duration-150 hover:text-text " +
          (large ? "text-[22px] tracking-[-.01em] max-[720px]:text-[19px] " : "text-[12.5px] ") +
          (open || large ? "text-text " : "text-text2 ") +
          className
        }
      >
        {monthLabel(value)}
        <svg width={large ? 15 : 11} height={large ? 15 : 11} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none opacity-70">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-(--z-popover)" />
          <div
            ref={pop}
            role="dialog"
            aria-modal="false"
            aria-label="Choose a month"
            onKeyDown={onKey}
            // Left-anchored, not centred: the month control sits near the left edge, where a centred popover would hang off-screen on phones.
            className="absolute top-[calc(100%+9px)] left-0 z-(--z-popover) w-[232px] max-w-[calc(100vw-40px)] rounded-[13px] border border-wi bg-card p-[13px] overscroll-contain"
            style={{ boxShadow: "var(--shadow-pop)", animation: "dpop .14s ease" }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <YearArrow dir="prev" label="Previous year" onClick={() => setVy((y) => y - 1)} />
              <span className="font-mono text-[13px] font-bold tracking-[.02em] text-text tabular-nums">{vy}</span>
              <YearArrow dir="next" label="Next year" disabled={vy >= maxP.y} onClick={() => setVy((y) => y + 1)} />
            </div>

            <div role="grid" aria-label={String(vy)} className="grid grid-cols-3 gap-1.5">
              {MON.map((name, i) => {
                const k = keyOf(vy, i);
                const selected = k === value;
                const disabled = k > max;
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    data-key={k}
                    tabIndex={k === focusKey ? 0 : -1}
                    disabled={disabled}
                    aria-selected={selected}
                    aria-label={fmt.format(new Date(vy, i, 1))}
                    onClick={() => pick(k)}
                    className="flex h-[38px] items-center justify-center rounded-[9px] border font-mono text-[12.5px] transition-[background] duration-[120ms] not-disabled:cursor-pointer disabled:cursor-default disabled:opacity-30"
                    style={{
                      color: selected ? "var(--bg)" : "var(--text)",
                      background: selected ? ACC : "transparent",
                      borderColor: k === max && !selected ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "transparent",
                    }}
                    onMouseEnter={(e) => !selected && !disabled && (e.currentTarget.style.background = HOVER)}
                    onMouseLeave={(e) => !selected && (e.currentTarget.style.background = "transparent")}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function YearArrow({ dir, label, disabled, onClick }: { dir: "prev" | "next"; label: string; disabled?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-none bg-chip text-text2 not-disabled:cursor-pointer not-disabled:hover:bg-[color-mix(in_srgb,var(--accent)_18%,var(--chip))] disabled:cursor-default disabled:opacity-35"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
