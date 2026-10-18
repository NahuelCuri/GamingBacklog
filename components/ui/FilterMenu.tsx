"use client";

// A filter as one toolbar button ("Tags ▾") that opens its options: a small
// panel under the button on desktop, a sheet from the bottom on phones. The
// button names what's picked ("Tags: CRPG +1") and has a ✕ to clear it, so the
// applied filters read off the toolbar without a row of chips.
import { useMemo, useRef, useState } from "react";
import { CaretUpIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { useDialog } from "@/lib/hooks/useDialog";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  /** Nothing left to show with it (given what's picked): listed, dimmed. */
  disabled?: boolean;
}

/** Desktop panel width, px. */
const PANEL_W = 260;

/** Show a search box inside the panel once there are more options than this. */
const SEARCH_FROM = 10;

export function FilterMenu({
  label,
  options,
  picked,
  onChange,
  multi,
  mobile,
  hint,
}: {
  label: string;
  options: FilterOption[];
  picked: string[];
  onChange(next: string[]): void;
  /** Several at once (tags) or one (how it was got). */
  multi?: boolean;
  mobile: boolean;
  /** Under the options' heading, e.g. "Games with all of them". */
  hint?: string;
}) {
  // Where the panel opened: it stays there while the button grows with what's picked.
  const [open, setOpen] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const toggleOpen = () => {
    if (open) return setOpen(null);
    const r = btn.current!.getBoundingClientRect();
    setOpen({ top: r.bottom + 6, left: Math.max(12, Math.min(r.left, window.innerWidth - PANEL_W - 12)) });
  };
  const names = picked.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const summary = names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "") : "";
  const toggle = (v: string) => onChange(multi ? (picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]) : picked[0] === v ? [] : [v]);

  return (
    <div className="relative flex">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={!!open}
        onClick={toggleOpen}
        className={
          "flex max-w-[240px] min-w-0 cursor-pointer items-center gap-1.5 rounded-[9px] border bg-topchip text-[12.5px] font-medium whitespace-nowrap transition-[color,border-color] duration-200 hover:border-wi hover:text-text " +
          (summary ? "border-wi pr-8 pl-3 text-text" : "border-wd px-3 text-text2") +
          (mobile ? " w-full justify-between py-2.5" : " py-[9px]")
        }
      >
        <span className="truncate">
          {label}
          {summary && <span className="font-normal text-accent">{": " + summary}</span>}
        </span>
        {!summary && (
          <span aria-hidden className="rotate-180 text-dim">
            <CaretUpIcon size={11} />
          </span>
        )}
      </button>
      {summary && (
        <button
          type="button"
          aria-label={"Clear " + label}
          onClick={() => onChange([])}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-wc hover:text-text"
        >
          <CloseIcon size={11} />
        </button>
      )}
      {open && <Panel at={open} label={label} hint={hint} options={options} picked={picked} multi={!!multi} mobile={mobile} onToggle={toggle} onClear={() => onChange([])} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Panel({
  at,
  label,
  hint,
  options,
  picked,
  multi,
  mobile,
  onToggle,
  onClear,
  onClose,
}: {
  at: { top: number; left: number };
  label: string;
  hint?: string;
  options: FilterOption[];
  picked: string[];
  multi: boolean;
  mobile: boolean;
  onToggle(v: string): void;
  onClear(): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const body = (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      className={
        "flex flex-col border border-wg bg-card outline-none " +
        (mobile
          ? "max-h-[75dvh] w-full rounded-t-2xl pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
          : "fixed z-(--z-popover) max-h-[360px] rounded-xl")
      }
      style={{
        boxShadow: "var(--shadow-pop)",
        animation: mobile ? "drawerRise .24s var(--ease-out)" : "dpop .14s ease",
        ...(mobile ? {} : { top: at.top, left: at.left, width: PANEL_W }),
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text">{label}</div>
          {hint && <div className="text-[11.5px] text-muted">{hint}</div>}
        </div>
        {picked.length > 0 && (
          <button type="button" onClick={onClear} className="cursor-pointer border-none bg-transparent p-0 text-xs text-accent underline-offset-2 hover:underline">
            Clear
          </button>
        )}
      </div>
      {options.length > SEARCH_FROM && (
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-wf bg-topchip px-2.5 text-dim focus-within:border-wi">
          <SearchIcon size={12} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={"Search " + label.toLowerCase()}
            placeholder="Search…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-none bg-transparent py-2 text-[13px] text-text outline-none"
          />
        </label>
      )}
      <div role="group" aria-label={label} className="g-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {shown.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={o.disabled}
              onClick={() => {
                onToggle(o.value);
                if (!multi) onClose();
              }}
              className={
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2 text-left text-[13px] hover:bg-wc disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent " +
                (mobile ? "min-h-11" : "min-h-9") +
                (on ? " text-text" : " text-text2")
              }
            >
              <span
                aria-hidden
                className={
                  "flex size-4 flex-none items-center justify-center border " +
                  (multi ? "rounded-[4px] " : "rounded-full ") +
                  (on ? "border-accent bg-accent text-on-accent" : "border-wi")
                }
              >
                {on && (multi ? <Check /> : <span className="size-1.5 rounded-full bg-on-accent" />)}
              </span>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.count != null && <span className="font-mono text-[11px] text-muted tabular-nums">{o.count}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <div className="px-2 py-3 text-xs text-muted">Nothing matches.</div>}
      </div>
    </div>
  );

  // Phones: a sheet over a dimmed page. Desktop: a panel under the button, closed by a click outside.
  return mobile ? (
    <div onClick={onClose} className="fixed inset-0 z-(--z-overlay) flex items-end bg-[rgba(6,7,7,.6)]" style={{ animation: "gfade .16s ease" }}>
      {body}
    </div>
  ) : (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-(--z-popover)" />
      {body}
    </>
  );
}

function Check() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M2 5.2 4.1 7.3 8 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
