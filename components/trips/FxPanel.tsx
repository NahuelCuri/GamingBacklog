"use client";

// Currency quick-convert, a floating panel above the library switcher.
import { useCallback, useEffect, useState } from "react";
import { CloseIcon, RefreshIcon, SwapVerticalIcon } from "@/components/icons";
import { ccy, fetchFx, nfx, rateLine, readFxPref, saveFxPref, searchCcy } from "@/lib/trips/fx";
import { IconButton, Kicker, cx, inputCls } from "./ui";

type Which = "from" | "to";

const big = "min-w-0 flex-1 rounded-[9px] px-3 py-2 font-mono text-base font-bold";

export function FxPanel({ onClose }: { onClose(): void }) {
  const [pair, setPair] = useState(readFxPref);
  const [turn, setTurn] = useState(0);
  const [amount, setAmount] = useState("100");
  const [drop, setDrop] = useState<Which | null>(null);
  const [search, setSearch] = useState("");
  const [rate, setRate] = useState<{ rate: number; updated: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback((from: string, to: string) => {
    setStatus("loading");
    setRate(null);
    fetchFx(from, to).then(
      (r) => {
        setRate(r);
        setStatus("idle");
      },
      () => setStatus("error"),
    );
  }, []);

  useEffect(() => load(pair.from, pair.to), [pair, load]);

  // Escape closes the panel (when no dialog is open on top).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[aria-modal="true"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (which: Which, code: string) => {
    const next = which === "from" ? { ...pair, from: code } : { ...pair, to: code };
    saveFxPref(next.from, next.to);
    setPair(next);
    setDrop(null);
  };
  const swap = () => {
    saveFxPref(pair.to, pair.from);
    setPair({ from: pair.to, to: pair.from });
  };

  const amt = parseFloat(amount);
  const result = rate && !isNaN(amt) ? amt * rate.rate : null;

  const dropdown = (which: Which) => {
    const active = which === "from" ? pair.from : pair.to;
    return (
      <div
        role="listbox"
        aria-label={which === "from" ? "Convert from" : "Convert to"}
        className={cx("absolute right-0 z-[5] flex max-h-[260px] w-[236px] origin-top-right flex-col overflow-hidden rounded-xl border border-wh bg-card shadow-[var(--shadow-pop)] [animation:dpop_.16s_var(--ease-out)]", which === "from" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]")}
      >
        <div className="border-b border-wf p-2">
          <input type="search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search currency" autoComplete="off" spellCheck={false} placeholder="Search currency…" className={cx(inputCls, "py-2")} />
        </div>
        <div className="overflow-y-auto p-1.5">
          {searchCcy(search).map((o) => {
            const on = o.c === active;
            return (
              <button
                key={o.c}
                type="button"
                role="option"
                aria-selected={on}
                aria-label={`${o.c} — ${o.n}`}
                onClick={() => choose(which, o.c)}
                className={cx("flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors", on ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "hover:bg-wc")}
              >
                <span className={cx("w-11 shrink-0 font-mono text-13 font-bold", on ? "text-accent2" : "text-text")}>{o.c}</span>
                <span className="min-w-0 flex-1 truncate text-13 text-text2">{o.n}</span>
                <span className="w-8 shrink-0 text-right font-mono text-13 text-muted">{o.s}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const picker = (which: Which) => {
    const code = which === "from" ? pair.from : pair.to;
    return (
      <div className="relative w-24 shrink-0">
        <button
          type="button"
          onClick={() => {
            setDrop((d) => (d === which ? null : which));
            setSearch("");
          }}
          aria-haspopup="listbox"
          aria-expanded={drop === which}
          aria-label={(which === "from" ? "Convert from " : "Convert to ") + code}
          className="flex h-full w-full cursor-pointer items-center justify-between gap-1.5 rounded-[9px] border border-wh bg-inset px-2.5 transition-colors hover:border-wl"
        >
          <span className="font-mono text-13 font-bold text-text">{code}</span>
          <span className="text-2xs text-muted">{ccy(code)?.s || ""}</span>
        </button>
        {drop === which && dropdown(which)}
      </div>
    );
  };

  return (
    <div
      role="region"
      aria-label="Currency converter"
      className="fixed right-[max(env(safe-area-inset-right,0px),18px)] bottom-[calc(env(safe-area-inset-bottom,0px)+86px)] z-[var(--z-panel)] w-[min(calc(100vw-36px),320px)] origin-bottom-right rounded-2xl border border-wh bg-card shadow-[var(--shadow-pop)] [animation:compBtnIn_.22s_cubic-bezier(.22,1,.36,1)]"
    >
      <div className="flex items-center justify-between border-b border-wf py-1.5 pr-1.5 pl-3.5">
        <Kicker>Convert</Kicker>
        <IconButton onClick={onClose} title="Close" aria-label="Close converter">
          <CloseIcon size={14} />
        </IconButton>
      </div>
      <div className="p-3.5">
        <div className="mb-2 flex items-stretch gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount to convert" autoComplete="off" placeholder="0.00" className={cx(big, "border border-wh bg-inset text-text outline-none")} />
          {picker("from")}
        </div>
        <div className="mt-0.5 mb-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-wf" />
          <IconButton
            tone="framed"
            onClick={() => {
              swap();
              setTurn((r) => r + 180);
            }}
            title="Swap"
            aria-label="Swap currencies"
            style={{ transform: `rotate(${turn}deg)`, transition: "transform 260ms var(--ease-out), border-color .15s" }}
            className="rounded-full text-accent"
          >
            <SwapVerticalIcon size={15} />
          </IconButton>
          <div className="h-px flex-1 bg-wf" />
        </div>
        <div className="flex items-stretch gap-2">
          <div aria-live="polite" className={cx(big, "flex items-center truncate border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--inset))] text-accent2")}>
            {result == null ? "—" : nfx(result, 2)}
          </div>
          {picker("to")}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {status === "loading" && <div className="font-mono text-2xs text-muted">Fetching…</div>}
            {status === "error" && <div className="text-2xs text-pretty text-warn">Rate unavailable — retry</div>}
            {rate && (
              <div title={rate.updated ? "as of " + rate.updated : undefined} className="truncate font-mono text-2xs text-muted">
                {rateLine(pair.from, pair.to, rate.rate)}
              </div>
            )}
          </div>
          <IconButton tone="framed" onClick={() => load(pair.from, pair.to)} title="Refresh rate" aria-label="Refresh exchange rate">
            <RefreshIcon size={14} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
