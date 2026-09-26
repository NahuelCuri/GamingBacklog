"use client";

// Currency quick-convert, a floating panel above the library switcher.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ccy, fetchFx, nfx, rateLine, readFxPref, saveFxPref, searchCcy } from "@/lib/trips/fx";
import { T } from "./styles";

type Which = "from" | "to";

export function FxPanel({ onClose }: { onClose(): void }) {
  const [pair, setPair] = useState(readFxPref);
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
      <div role="listbox" aria-label={which === "from" ? "Convert from" : "Convert to"} style={{ position: "absolute", ...(which === "from" ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }), right: 0, width: 236, maxHeight: 260, display: "flex", flexDirection: "column", background: "#171c1e", border: `1px solid ${T.border2}`, borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,.6)", zIndex: 5, overflow: "hidden", animation: "compBtnIn .16s ease" }}>
        <div style={{ padding: 8, borderBottom: `1px solid ${T.line}` }}>
          <input type="search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search currency" autoComplete="off" spellCheck={false} placeholder="Search currency…" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div style={{ overflowY: "auto", padding: 6 }}>
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
                className="hover:!bg-[rgba(95,184,176,.08)]"
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderRadius: 8, border: "none", transition: "background .12s", background: on ? "rgba(95,184,176,.12)" : "transparent", textAlign: "left" }}
              >
                <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, color: on ? "#7fe3d8" : T.text, flex: "0 0 44px" }}>{o.c}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#a9b3b0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{o.n}</span>
                <span style={{ fontSize: 13, color: T.dim3, flex: "0 0 30px", textAlign: "right", fontFamily: T.mono }}>{o.s}</span>
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
      <div style={{ position: "relative", flex: "0 0 96px" }}>
        <button
          type="button"
          onClick={() => {
            setDrop((d) => (d === which ? null : which));
            setSearch("");
          }}
          aria-haspopup="listbox"
          aria-expanded={drop === which}
          aria-label={(which === "from" ? "Convert from " : "Convert to ") + code}
          className="hover:!border-[#3a6b66]"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, height: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0 10px", cursor: "pointer", transition: "border-color .15s" }}
        >
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>{code}</span>
          <span style={{ fontSize: 11, color: T.dim3 }}>{ccy(code)?.s || ""}</span>
        </button>
        {drop === which && dropdown(which)}
      </div>
    );
  };

  const big: CSSProperties = { flex: 1, minWidth: 0, borderRadius: 9, padding: "9px 11px", fontSize: 16, fontWeight: 700, fontFamily: T.mono };

  return (
    <div role="region" aria-label="Currency converter" style={{ position: "fixed", right: "max(env(safe-area-inset-right, 0px), 18px)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)", zIndex: 320, width: "min(calc(100vw - 36px), 320px)", background: T.card, border: `1px solid ${T.border2}`, borderRadius: 16, boxShadow: "0 18px 50px rgba(0,0,0,.55)", animation: "compBtnIn .22s cubic-bezier(.22,1,.36,1)", transformOrigin: "bottom right" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: ".09em", textTransform: "uppercase", color: "#7f8c89" }}>Convert</div>
        <button type="button" onClick={onClose} title="Close" aria-label="Close converter" className="hover:!text-[#e9edee]" style={{ cursor: "pointer", width: 24, height: 24, border: "none", background: "none", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted2, fontSize: 15 }}>
          ✕
        </button>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 8 }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount to convert" autoComplete="off" placeholder="0.00" style={{ ...big, background: T.bg, border: `1px solid ${T.border}`, color: T.text, outline: "none" }} />
          {picker("from")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "2px 0 8px" }}>
          <div style={{ flex: 1, height: 1, background: "#222829" }} />
          <button type="button" onClick={swap} title="Swap" aria-label="Swap currencies" className="hover:!border-[#5fb8b0]" style={{ cursor: "pointer", flex: "0 0 auto", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, border: `1px solid ${T.border2}`, color: T.accent, fontSize: 15, transition: "border-color .15s" }}>
            ⇅
          </button>
          <div style={{ flex: 1, height: 1, background: "#222829" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div aria-live="polite" style={{ ...big, background: "#0e1512", border: "1px solid #274b45", display: "flex", alignItems: "center", color: "#7fe3d8", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {result == null ? "—" : nfx(result, 2)}
          </div>
          {picker("to")}
        </div>
        <div style={{ marginTop: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            {status === "loading" && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>Fetching…</div>}
            {status === "error" && <div style={{ fontSize: 11, color: T.warn, textWrap: "pretty" }}>Rate unavailable — retry</div>}
            {rate && (
              <div title={rate.updated ? "as of " + rate.updated : undefined} style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {rateLine(pair.from, pair.to, rate.rate)}
              </div>
            )}
          </div>
          <button type="button" onClick={() => load(pair.from, pair.to)} title="Refresh rate" aria-label="Refresh exchange rate" className="hover:!border-[#5fb8b0] hover:!text-[#e9edee]" style={{ cursor: "pointer", flex: "0 0 auto", color: T.muted, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", fontSize: 13 }}>
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}
