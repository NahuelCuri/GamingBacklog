"use client";

// Roulette tab: build a pool (filters or hand-picked), spin the reel, act on
// the winner. The reel eases out over 4.8s, runs a few px past and settles;
// reduced motion skips straight to it.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { CountUp } from "@/components/ui/CountUp";
import { accentButton, neutralButton, toggleChip } from "@/components/ui/Pills";
import {
  REEL, defaultRouletteState, pickRandom, pickSuggestions, pool as buildPool, primaryKey, pushRecent, reelCard, reelStrip, reelTarget,
  tagCloud, winnerActive, type RouletteState,
} from "@/lib/collection";
import type { Item } from "@/lib/collection/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useCollectionCtx } from "./CollectionContext";

const DURATION = 4800;
const ease = (t: number) => 1 - Math.pow(1 - t, 3.4);
/** How far past the target the reel runs, and the share of DURATION spent getting there. */
const OVERSHOOT = 6;
const MAIN = 0.88;

/** Strip position at t in [0,1]: ease out to just past the target, then settle back onto it. */
function reelX(target: number, t: number) {
  const peak = target + Math.sign(target || -1) * OVERSHOOT;
  if (t < MAIN) return peak * ease(t / MAIN);
  const u = (t - MAIN) / (1 - MAIN);
  return peak + (target - peak) * u * u * (3 - 2 * u);
}
const eyebrow = "text-[10px] font-semibold tracking-[.09em] text-dim uppercase";

const chip = (on: boolean) => toggleChip(on, "border-wf bg-inset text-text2");
/** Stagger step for the winner panel's parts (see .g-rise). */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export function RouletteView() {
  const { cfg, items, actions, isMobile, openEdit } = useCollectionCtx();
  const r = cfg.roulette!;
  const primary = primaryKey(cfg);
  const [st, setSt] = useState<RouletteState>(() => defaultRouletteState(cfg));
  const [search, setSearch] = useState("");
  const [reel, setReel] = useState<Item[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Item | null>(null);
  const [recent, setRecent] = useState<Item[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const poolItems = useMemo(() => buildPool(cfg, items, st), [cfg, items, st]);
  const cloud = useMemo(() => tagCloud(cfg, items), [cfg, items]);
  const suggest = pickSuggestions(cfg, items, st.rPicked, search);
  const picked = st.rPicked.map((id) => items.find((g) => g.id === id)).filter((g): g is Item => !!g);
  const blocked = spinning || poolItems.length === 0;

  const finish = (w: Item) => {
    setSpinning(false);
    setWinner(w);
    setRecent((rc) => pushRecent(rc, w));
  };

  const spin = () => {
    if (blocked) return;
    const w = pickRandom(poolItems);
    if (reduced) {
      setReel([]);
      finish(w);
      return;
    }
    const target = reelTarget();
    setReel(reelStrip(poolItems, w));
    setSpinning(true);
    setWinner(null);
    let start = 0;
    const step = (now: number) => {
      const el = strip.current;
      if (!el) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      el.style.transform = `translateX(${reelX(target, t)}px)`;
      if (t < 1) raf.current = requestAnimationFrame(step);
      else finish(w);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  };

  const startAction = () => {
    if (!winner) return;
    const g = { ...winner, [r.startAction.field]: r.startAction.value };
    actions?.save(g);
    setWinner(g);
  };

  const active = winnerActive(cfg, winner);
  const landed = !!winner && !spinning;
  const scoreV = winner?.[r.winnerScoreField];
  const subV = winner?.[r.winnerSubField];

  return (
    <div className="grid items-start gap-6 pt-[26px]" style={{ gridTemplateColumns: isMobile ? "1fr" : "360px 1fr", animation: "gfade .2s ease" }}>
      {/* pool builder */}
      <div className="min-w-0 rounded-[14px] border border-wd bg-surface px-5 pt-5 pb-[22px]">
        <div className="mb-[3px] text-[15px] font-bold">Build your pool</div>
        <div className="mb-[18px] text-[12.5px] text-muted">Narrow it down, then let fate pick.</div>

        <div className="relative mb-[18px] flex gap-1 rounded-[9px] border border-wd bg-inset p-[3px]">
          {/* one accent pill slides between the two options */}
          <span
            aria-hidden
            className="absolute inset-y-[3px] left-[3px] rounded-md bg-accent transition-transform duration-[320ms] ease-[var(--ease-out)]"
            style={{ width: "calc(50% - 5px)", transform: st.rmode === "picked" ? "translateX(calc(100% + 4px))" : "none" }}
          />
          {(["filters", "picked"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={st.rmode === m}
              onClick={() => setSt((s) => ({ ...s, rmode: m }))}
              className={
                "relative flex-1 cursor-pointer rounded-md border-none bg-transparent p-[7px] text-center text-[12.5px] font-semibold transition-[color,background-color] duration-200 " +
                (st.rmode === m ? "text-on-accent" : "text-muted hover:bg-wc hover:text-text")
              }
            >
              {m === "filters" ? "By filters" : "Hand-pick"}
            </button>
          ))}
        </div>

        {st.rmode === "filters" ? (
          <div>
            <div className={eyebrow + " mb-2"}>Status</div>
            <div className="mb-[18px] flex gap-[5px]">
              {r.statusFilters.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={st.rStatus === c.value}
                  onClick={() => setSt((s) => ({ ...s, rStatus: c.value }))}
                  className={chip(st.rStatus === c.value) + " flex-1 rounded-lg px-1 py-[7px] text-center text-xs font-medium"}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {r.band && (
              <>
                <div className={eyebrow + " mb-2"}>{r.band.label}</div>
                <div className="mb-[18px] flex flex-wrap gap-[5px]">
                  {r.band.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={st.rLength === o.value}
                      onClick={() => setSt((s) => ({ ...s, rLength: o.value }))}
                      className={chip(st.rLength === o.value) + " rounded-lg px-[11px] py-[7px] text-xs font-medium"}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mb-[9px] flex items-center justify-between">
              <span className={eyebrow}>Tags · any of</span>
              {st.rTags.length > 0 && (
                <button type="button" onClick={() => setSt((s) => ({ ...s, rTags: [] }))} className="cursor-pointer border-none bg-transparent p-0 text-[11px] text-accent underline-offset-2 hover:underline">
                  clear
                </button>
              )}
            </div>
            <div className="g-scroll flex max-h-[168px] flex-wrap gap-1.5 overflow-auto">
              {cloud.map(({ tag, count }) => {
                const on = st.rTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSt((s) => ({ ...s, rTags: on ? s.rTags.filter((x) => x !== tag) : [...s.rTags, tag] }))}
                    className={toggleChip(on, "border-we bg-chip2 text-muted2") + " rounded-[20px] px-2.5 py-[5px] text-[11.5px]"}
                  >
                    {tag} <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search an item to add to the draw"
              autoComplete="off"
              spellCheck={false}
              placeholder={`Search a ${cfg.noun} to add…`}
              className="mb-2.5 w-full rounded-[9px] border border-wh bg-inset px-3 py-[9px] text-[13px] text-text"
            />
            {suggest.length > 0 && (
              <div className="g-scroll mb-[14px] flex max-h-[190px] flex-col gap-[2px] overflow-auto">
                {suggest.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-label={`Add ${g[primary]} to the draw`}
                    onClick={() => {
                      setSt((s) => ({ ...s, rPicked: [...s.rPicked, g.id] }));
                      setSearch("");
                    }}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-[7px] border-none bg-chip2 px-2.5 py-2 text-[12.5px] text-text2 transition-colors duration-150 hover:bg-wd hover:text-text"
                  >
                    <span className="truncate">{String(g[primary])}</span>
                    <PlusIcon size={12} className="text-accent" />
                  </button>
                ))}
              </div>
            )}
            <div className={eyebrow + " mb-[9px]"}>In the draw · {st.rPicked.length}</div>
            {picked.length ? (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-label={`Remove ${g[primary]} from the draw`}
                    onClick={() => setSt((s) => ({ ...s, rPicked: s.rPicked.filter((x) => x !== g.id) }))}
                    className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border px-2.5 py-[5px] text-xs text-accent transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[.97]"
                    style={{ background: "color-mix(in srgb, var(--accent) 13%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
                  >
                    {String(g[primary])}
                    <CloseIcon size={10} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[12.5px] text-dim">Nothing added yet — search above.</div>
            )}
          </div>
        )}
      </div>

      {/* reel + result */}
      <div className="min-w-0">
        <div className="mb-1.5 text-center">
          <div className="text-xl font-bold tracking-[-.02em]">Can&apos;t decide? Spin.</div>
          <div className="mt-[3px] text-[12.5px] text-muted">
            <span
              key={poolItems.length}
              className="inline-block font-mono"
              style={{ color: poolItems.length ? "var(--accent)" : "var(--neg)", animation: "gtick 220ms var(--ease-out)" }}
            >
              {poolItems.length}
            </span>
            {/* one text node, as in legacy, so i18n leaves the sentence whole */}
            {` ${cfg.nounPlural} in the pool`}
          </div>
        </div>

        <div className="relative mx-auto mt-[18px] h-[118px] w-[700px] max-w-full overflow-hidden rounded-[13px] border border-we bg-inset">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-[120px]" style={{ background: "linear-gradient(90deg, var(--inset), transparent)" }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-[120px]" style={{ background: "linear-gradient(270deg, var(--inset), transparent)" }} />
          <div
            className="absolute inset-y-0 left-1/2 z-[3] w-[2px] -translate-x-px bg-accent"
            style={{ boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 60%, transparent)" }}
          />
          <div className="absolute -top-px left-1/2 z-[3] h-0 w-0 -translate-x-[6px]" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid var(--accent)" }} />
          <div className="absolute -bottom-px left-1/2 z-[3] h-0 w-0 -translate-x-[6px]" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "7px solid var(--accent)" }} />
          {reel.length > 0 ? (
            <div ref={strip} aria-hidden className="absolute top-[14px] left-1/2 flex gap-3">
              {reel.map((g, i) => {
                const c = reelCard(cfg, g);
                return (
                  <div
                    key={i}
                    className={
                      "flex h-[90px] w-[150px] flex-none flex-col justify-between rounded-[10px] border bg-chip2 px-3 py-[11px] transition-[scale,border-color] duration-[320ms] ease-[var(--ease-out)] " +
                      (landed && i === REEL.winnerIndex ? "scale-[1.04] border-accent" : "border-wd")
                    }
                  >
                    <div className="line-clamp-2 text-[12.5px] leading-[1.25] font-semibold">{c.title}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c.dot, boxShadow: c.glow ? "0 0 7px var(--accent)" : "none" }} />
                      <span className="font-mono text-[10.5px] text-muted">{c.sub}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-dim">
              {poolItems.length ? "Hit spin to roll the reel." : "Pool is empty — widen your filters."}
            </div>
          )}
        </div>

        <div className="mt-[18px] text-center">
          <button
            type="button"
            onClick={spin}
            aria-disabled={blocked}
            className={accentButton + " rounded-[11px] px-10 py-[13px] text-[15px] font-bold"}
          >
            {spinning ? "Spinning…" : "Spin"}
          </button>
        </div>

        <div aria-live="polite" className="sr-only">
          {winner && !spinning ? `Winner: ${winner[primary]}` : ""}
        </div>

        {winner && !spinning && (
          <div
            className="mt-6 rounded-[14px] border px-6 py-[22px]"
            style={{
              background: "linear-gradient(160deg, color-mix(in srgb, var(--accent) 9%, transparent), color-mix(in srgb, var(--accent) 2%, transparent))",
              borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
              animation: "gpop .3s ease",
            }}
          >
            <div className="g-rise mb-2.5 text-[10px] font-semibold tracking-[.12em] text-accent uppercase" style={rise(1)}>
              Tonight you play
            </div>
            <div className="g-rise flex items-start justify-between gap-4" style={{ ...rise(2), flexDirection: isMobile ? "column" : "row" }}>
              <div className="min-w-0">
                <div className="text-2xl leading-[1.15] font-bold tracking-[-.02em]">{String(winner[primary])}</div>
                <div className="mt-[11px] flex flex-wrap gap-1.5">
                  {((winner[cfg.tagField] as string[]) || []).map((t, i) => (
                    <span key={i} className="rounded-[5px] bg-chip px-[9px] py-[3px] text-[11.5px] text-muted2">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-none font-mono" style={{ textAlign: isMobile ? "left" : "right" }}>
                <div className="text-[28px] font-semibold text-accent">{scoreV != null ? <CountUp value={String(scoreV)} /> : "—"}</div>
                <div className="mt-[2px] text-[11px] text-muted">{subV != null ? String(subV) + (r.winnerSubSuffix ?? "") : "—"}</div>
              </div>
            </div>
            {!!String(winner[cfg.detail.reviewField] ?? "").trim() && (
              <div className="g-rise mt-[14px] text-[13px] leading-[1.6] text-text3 italic" style={rise(3)}>
                {String(winner[cfg.detail.reviewField])}
              </div>
            )}
            <div className="g-rise mt-[18px] flex flex-wrap gap-[9px]" style={rise(4)}>
              <button type="button" onClick={startAction} className={accentButton + " px-[18px] py-[9px] text-[13px] font-bold"}>
                {active ? r.startAction.activeLabel : r.startAction.label}
              </button>
              <button type="button" onClick={spin} className={neutralButton + " px-[18px] py-[9px] text-[13px]"}>
                Spin again
              </button>
              <button type="button" onClick={() => openEdit(winner)} className="cursor-pointer rounded-[9px] border border-wh bg-transparent px-[18px] py-[9px] text-[13px] font-semibold text-muted transition-[color,border-color] duration-200 hover:border-wk hover:text-text">
                Details
              </button>
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-[22px]">
            <div className={eyebrow + " mb-[9px]"}>Recent spins</div>
            <div className="flex flex-wrap gap-[7px]">
              {recent.map((g) => (
                <span
                  key={g.id}
                  className="rounded-[20px] border border-wd bg-chip2 px-[11px] py-[5px] text-xs text-muted2"
                  style={{ animation: "gchipin 260ms var(--ease-out) both" }}
                >
                  {String(g[primary])}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
