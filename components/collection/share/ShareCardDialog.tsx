"use client";

// Per-item shareable card: choose which details appear, add a caption,
// copy or download as PNG.
import { useRef, useState } from "react";
import { cardFileName, defaultCardSelection, shareCard } from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { useCollectionCtx } from "../CollectionContext";
import { ShareShell, TogglePill, eyebrow, textInput } from "./ShareShell";

const mono = "font-mono";
const label = "text-[9.5px] font-semibold tracking-[.08em] text-dim uppercase";

export function ShareCardDialog({ item, onClose }: { item: Item; onClose(): void }) {
  const { cfg, money } = useCollectionCtx();
  const [sel, setSel] = useState(() => defaultCardSelection(cfg, item));
  const [caption, setCaption] = useState("");
  const card = useRef<HTMLDivElement>(null);
  const c = shareCard(cfg, item, sel, money);
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <ShareShell
      label={"Share this " + (cfg.noun || "item")}
      subtitle="Pick what to show on the card, then copy or download."
      width={940}
      zIndex={70}
      onClose={onClose}
      previewRef={card}
      pixelRatio={2.5}
      fileName={cardFileName(cfg, item) + ".png"}
      shareTitle={c.title || "My card"}
      canCopy={!c.empty}
      controls={
        <>
          <div className={eyebrow + " mb-[7px]"}>Caption · optional</div>
          <input
            className={textInput + " mb-[18px]"}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            aria-label="Caption (optional)"
            autoComplete="off"
            placeholder="Add a note…"
          />
          <div className={eyebrow + " mb-[9px]"}>Show on card</div>
          <div className="mb-5 flex flex-wrap gap-[7px]">
            {c.chips.map((ch) => (
              <TogglePill key={ch.key} on={ch.on} label={ch.label} onClick={() => setSel((s) => ({ ...s, [ch.key]: !s[ch.key] }))} />
            ))}
          </div>
        </>
      }
      preview={
        <div ref={card} className="w-[460px] rounded-[20px] border border-wg bg-bg px-8 pt-[30px] pb-8 text-text">
          <div className="flex items-baseline gap-[9px]">
            <span translate="no" className="text-lg font-bold tracking-[-.02em]">
              {cfg.brand}
            </span>
            <span className={mono + " text-[11px] text-dim"}>{cfg.kicker}</span>
            <span className="flex-1" />
            <span className={mono + " text-[10.5px] text-dim"}>{date}</span>
          </div>
          <div className="mt-4 text-[29px] leading-[1.1] font-extrabold tracking-[-.025em] text-pretty">{c.title}</div>
          {caption.trim() && <div className="mt-[9px] text-sm leading-[1.45] font-medium text-text2">{caption}</div>}

          {(c.score || c.status) && (
            <div className="mt-[22px] flex items-center gap-4">
              {c.score && (
                <div className="flex items-baseline gap-1">
                  <span className="text-[15px] leading-none" style={{ color: c.score.color }}>
                    ★
                  </span>
                  <span className={mono + " text-[40px] leading-none font-semibold tracking-[-.03em]"} style={{ color: c.score.color }}>
                    {c.score.value}
                  </span>
                  <span className={mono + " text-sm text-dim"}>{c.score.max}</span>
                </div>
              )}
              <span className="flex-1" />
              {c.status && (
                <div className="flex items-center gap-2 rounded-[20px] border border-wd bg-card px-[14px] py-[7px]">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: c.status.dot, boxShadow: c.status.glow }} />
                  <span className="text-[13px] font-semibold" style={{ color: c.status.text }}>
                    {c.status.label}
                  </span>
                </div>
              )}
            </div>
          )}

          {c.stats.length > 0 && (
            <>
              <div className="mt-[22px] h-px bg-wf" />
              <div className="mt-5 grid grid-cols-2 gap-x-[18px] gap-y-4">
                {c.stats.map((s) => (
                  <div key={s.label}>
                    <div className={label + " mb-[5px]"}>{s.label}</div>
                    <div className={mono + " text-lg font-semibold tracking-[-.01em]"} style={{ color: s.color }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {c.tagGroups.length > 0 && (
            <div className="mt-[22px] flex flex-col gap-3">
              {c.tagGroups.map((tg) => (
                <div key={tg.label}>
                  <div className={label + " mb-2"}>{tg.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tg.tags.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-[20px] border px-[11px] py-1 text-xs text-accent2"
                        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 26%, transparent)" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {c.review && (
            <div className="mt-6 py-[2px] pl-[15px]" style={{ borderLeft: "2px solid color-mix(in srgb, var(--accent) 55%, transparent)" }}>
              <div className={label + " mb-[7px]"}>{c.review.label}</div>
              <div className="text-[13.5px] leading-[1.6] text-text3 italic">{c.review.text}</div>
            </div>
          )}

          {c.empty && <div className="px-1.5 pt-[30px] pb-2 text-center text-[13px] text-dim">Pick at least one detail to show.</div>}
        </div>
      }
    />
  );
}
