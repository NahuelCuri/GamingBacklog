"use client";

// Stats image: choose modules and a completion-year scope, add a caption,
// copy or download as PNG.
import { useMemo, useRef, useState } from "react";
import { defaultModuleSelection, scopeItems, shareModules, shareYears, withYearMode, type ShareScope, type YearMode } from "@/lib/collection";
import { useCollectionCtx } from "../CollectionContext";
import { ShareShell, TogglePill, eyebrow, textInput } from "./ShareShell";

const mono = "font-mono";
const select = "rounded-[9px] border border-wh bg-inset px-3 py-[9px] font-mono text-[13.5px] text-text";

export function ShareImageDialog({ onClose }: { onClose(): void }) {
  const { cfg, items, money } = useCollectionCtx();
  const [title, setTitle] = useState("");
  const [sel, setSel] = useState(() => defaultModuleSelection(cfg));
  const [scope, setScope] = useState<ShareScope>({ mode: "all", year: "", from: "", to: "" });
  const card = useRef<HTMLDivElement>(null);

  const years = useMemo(() => shareYears(cfg, items), [cfg, items]);
  const { items: scoped, label: scopeLabel } = scopeItems(cfg, items, scope);
  const modules = shareModules(cfg, scoped, sel, cfg.theme.accent, money);
  const anySel = cfg.stats.shareModules.some((m) => sel[m.key]);
  const date = new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" });

  const modeChip = (m: YearMode, label: string) => (
    <button
      key={m}
      type="button"
      aria-pressed={scope.mode === m}
      onClick={() => setScope((s) => withYearMode(cfg, items, s, m))}
      className="flex-1 cursor-pointer rounded-lg border px-1 py-2 text-center text-xs font-medium"
      style={
        scope.mode === m
          ? { color: "var(--onAccent)", background: "var(--accent)", borderColor: "var(--accent)" }
          : { color: "var(--text2)", background: "var(--chip)", borderColor: "var(--wf)" }
      }
    >
      {label}
    </button>
  );
  const yearSelect = (value: string, onChange: (v: string) => void, aria: string, cls = "") => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={aria} className={select + " " + cls}>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );

  return (
    <ShareShell
      label="Create shareable image"
      subtitle="Pick the stats to include, then copy or download."
      width={1000}
      zIndex={60}
      onClose={onClose}
      previewRef={card}
      pixelRatio={2}
      fileName={`backlog-stats-${new Date().toISOString().slice(0, 10)}.png`}
      shareTitle="My backlog stats"
      canCopy={anySel}
      controls={
        <>
          <div className={eyebrow + " mb-[7px]"}>Caption · optional</div>
          <input
            className={textInput + " mb-[18px]"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Caption (optional)"
            autoComplete="off"
            placeholder="My 2026 backlog"
          />
          <div className={eyebrow + " mb-[9px]"}>Time range · by completion year</div>
          <div className="mb-2.5 flex gap-[5px]">
            {modeChip("all", "All time")}
            {modeChip("year", "By year")}
            {modeChip("range", "Interval")}
          </div>
          {scope.mode === "year" && <div className="mb-[18px]">{yearSelect(scope.year, (v) => setScope((s) => ({ ...s, year: v })), "Completion year", "w-full")}</div>}
          {scope.mode === "range" && (
            <div className="mb-[18px] flex items-center gap-[9px]">
              {yearSelect(scope.from, (v) => setScope((s) => ({ ...s, from: v })), "Range start year", "flex-1")}
              <span className="text-xs text-dim">to</span>
              {yearSelect(scope.to, (v) => setScope((s) => ({ ...s, to: v })), "Range end year", "flex-1")}
            </div>
          )}
          <div className={eyebrow + " mb-[9px]"}>Include</div>
          <div className="mb-5 flex flex-wrap gap-[7px]">
            {cfg.stats.shareModules.map((m) => (
              <TogglePill key={m.key} on={!!sel[m.key]} label={m.label} onClick={() => setSel((s) => ({ ...s, [m.key]: !s[m.key] }))} />
            ))}
          </div>
        </>
      }
      preview={
        <div ref={card} className="w-[560px] rounded-[18px] border border-wg bg-bg px-[30px] pt-7 pb-[30px] text-text">
          <div className="flex items-baseline gap-[9px]">
            <span translate="no" className="text-[19px] font-bold tracking-[-.02em]">
              {cfg.brand}
            </span>
            <span className={mono + " text-[11px] text-dim"}>{cfg.kicker}</span>
            <span className="flex-1" />
            <span className={mono + " rounded-[20px] bg-accent px-2.5 py-[3px] text-[10px] font-semibold text-on-accent"}>{scopeLabel}</span>
            <span className={mono + " text-[10.5px] text-dim"}>{date}</span>
          </div>
          {title.trim() && <div className="mt-2 text-[15px] font-semibold tracking-[-.01em] text-text2">{title.trim()}</div>}
          <div className="mt-4 mb-1 h-px bg-wf" />
          {!anySel && <div className="px-2.5 py-[38px] text-center text-[13px] text-dim">Select at least one stat to build your image.</div>}
          {modules.map((m) => (
            <div key={m.key} className="mt-[18px]">
              <div className={eyebrow} style={{ marginBottom: m.kind === "cards" || m.kind === "bar" || (m.kind === "spending" && !m.has) ? 11 : 13 }}>
                {m.title}
              </div>
              {m.kind === "cards" && (
                <div className="grid grid-cols-3 gap-[9px]">
                  {m.cards.map((c) => (
                    <div key={c.label} className="rounded-[11px] border border-wd bg-card px-[14px] py-[13px]">
                      <div className={mono + " text-[22px] font-semibold tracking-[-.02em]"} style={{ color: c.color }}>
                        {c.value}
                      </div>
                      <div className="mt-[3px] text-[11px] text-muted">{c.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {m.kind === "bar" && (
                <div className="flex flex-col" style={{ gap: m.style.rowGap }}>
                  {m.rows.map((t, i) => (
                    <div key={i} className="flex items-center gap-[11px]">
                      {m.style.showRank && <div className={mono + " w-4 flex-none text-[11px] text-dim"}>{t.rank}</div>}
                      <div className="flex-none truncate" style={{ width: m.style.labelWidth, fontSize: m.style.labelSize, color: m.style.labelColor }}>
                        {t.label}
                      </div>
                      <div className="h-[7px] flex-1 overflow-hidden rounded bg-wd">
                        <div className="h-full rounded" style={{ width: t.pct, background: t.barColor, opacity: m.style.barOpacity }} />
                      </div>
                      <div
                        className={mono + " text-right"}
                        style={{ fontSize: m.style.valSize, fontWeight: m.style.valWeight as never, width: m.style.valWidth, color: m.style.valColor }}
                      >
                        {t.val}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(m.kind === "histogram" || m.kind === "byYear") && (
                <div className="flex items-end" style={{ height: m.kind === "histogram" ? 104 : 92, gap: m.kind === "histogram" ? 7 : 9 }}>
                  {m.bars.map((b, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <div className={mono + " text-[10px] text-muted"}>{b.count}</div>
                      <div
                        className="min-h-[3px] w-full rounded-[4px_4px_2px_2px]"
                        style={{ height: b.pct, background: "color" in b ? b.color : "var(--accent)", opacity: "color" in b ? 1 : 0.8 }}
                      />
                      <div className={mono + " text-[10px] text-dim"}>{b.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {m.kind === "spending" &&
                (m.has ? (
                  <div className="flex items-center gap-5">
                    <div className="flex h-[104px] w-[104px] flex-none items-center justify-center rounded-full" style={{ background: m.donut }}>
                      <div className="flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full bg-bg">
                        <div className={mono + " text-[15px] font-semibold"} style={{ color: "oklch(0.8 0.09 85)" }}>
                          {m.total}
                        </div>
                        <div className="text-[9px] text-dim">spent</div>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5">
                      {m.legend.map((l, i) => (
                        <div key={i} className="flex items-center gap-[9px]">
                          <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: l.color }} />
                          <span className="flex-1 text-[12.5px] text-text2">{l.label}</span>
                          <span className={mono + " text-[12.5px] font-semibold text-text2"}>{l.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-1.5 text-[12.5px] text-dim">{m.emptyMsg}</div>
                ))}
            </div>
          ))}
        </div>
      }
    />
  );
}
