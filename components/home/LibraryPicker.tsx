"use client";

// Post-login home: a greeting and a bento of the visible libraries. The big
// tile is the library opened last; every tile shows the numbers that library
// saved on this device (lib/home). Hovering tints the page from the tile, and
// opening one grows its colour from where you clicked.
import { useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { ArrowUpRightIcon, GearIcon, LIBRARY_ICON_COLOR, LibraryIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { CountUp } from "@/components/ui/CountUp";
import { LIBRARIES, isTripMember, type LibraryDef, type LibraryKey } from "@/config/libraries";
import { useAuth } from "@/lib/auth";
import { readHome, type LibSummary } from "@/lib/home";
import { readLang } from "@/lib/i18n/translator";

const SEEN_KEY = "bl_home_seen";

/** lg grid (4 columns) spans for the small tiles, by how many there are. The big tile is always 2×2. */
function smallSpans(n: number): { col: 1 | 2 | 4; row?: 2 }[] {
  if (n === 0) return [];
  if (n === 1) return [{ col: 2, row: 2 }];
  if (n === 2) return [{ col: 2 }, { col: 2 }];
  if (n === 3) return [{ col: 1 }, { col: 1 }, { col: 2 }];
  const rest = n - 4;
  return Array.from({ length: n }, (_, i) => (i < 4 ? { col: 1 as const } : { col: (rest === 1 ? 4 : 2) as 2 | 4 }));
}
const LG_COL = { 1: "lg:col-span-1", 2: "lg:col-span-2", 4: "lg:col-span-4" } as const;

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
}

/** The pointer when there is one, else the element's center (keyboard); used for the wash and the wipe. */
function pointOf(el: HTMLElement, e?: { clientX: number; clientY: number; detail?: number }) {
  if (e && e.detail !== 0 && (e.clientX || e.clientY)) return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Arrow keys move focus to the nearest tile in that direction. */
function moveFocus(e: KeyboardEvent<HTMLUListElement>) {
  const dir = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<string, [number, number]>)[e.key];
  const from = document.activeElement as HTMLElement | null;
  if (!dir || !from?.dataset.tile) return;
  const center = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const o = center(from);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  e.currentTarget.querySelectorAll<HTMLElement>("[data-tile]").forEach((el) => {
    if (el === from) return;
    const p = center(el);
    const along = (p.x - o.x) * dir[0] + (p.y - o.y) * dir[1];
    if (along <= 1) return;
    const across = Math.abs((p.x - o.x) * dir[1]) + Math.abs((p.y - o.y) * dir[0]);
    // Ties (a tall tile next to two stacked ones) go to the upper, then left one.
    const score = along + across * 2 + (p.y + p.x) * 0.001;
    if (score < bestScore) {
      best = el;
      bestScore = score;
    }
  });
  if (best) {
    e.preventDefault();
    (best as HTMLElement).focus();
  }
}

export function LibraryPicker() {
  const { libs, navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const [hover, setHover] = useState<LibraryKey | null>(null);
  // Where the hover wash grows from; starts mid-screen so the first one doesn't sweep in from a corner.
  const [wash, setWash] = useState(() => ({ x: innerWidth / 2, y: innerHeight / 2, color: LIBRARIES[0].color }));

  // Home only renders client-side (behind AuthGate), so reading storage up front is safe.
  const [memory] = useState(() => readHome(user?.id));
  const [now] = useState(() => new Date());
  const [seen] = useState(() => {
    try {
      const s = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
      return s;
    } catch {
      return false;
    }
  });

  const ordered = useMemo(() => {
    const cards = LIBRARIES.filter((l) => libs.includes(l.key) && (l.key !== "trips" || isTripMember(user?.id)));
    const big = cards.find((l) => l.key === memory.last) ?? cards[0];
    return big ? [big, ...cards.filter((l) => l !== big)] : [];
  }, [libs, user?.id, memory.last]);
  const spans = smallSpans(ordered.length - 1);

  // First visit this session gets the full entrance; coming back is quicker.
  const step = seen ? 25 : 55;
  const dur = seen ? 260 : 440;
  const riseStyle = (i: number) => ({ "--i": i, animationDuration: dur + "ms" }) as CSSProperties;

  const pal = hover ? wash.color : null;
  const chipBorder = pal ? `color-mix(in srgb, ${pal} 45%, transparent)` : "var(--wd)";
  const date = now.toLocaleDateString(readLang() === "es" ? "es-AR" : "en-US", { weekday: "long", day: "numeric", month: "long" });

  const enter = (l: LibraryDef, el: HTMLElement) => {
    setHover(l.key);
    setWash({ ...pointOf(el), color: l.color });
  };
  const spot = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", e.clientX - r.left + "px");
    e.currentTarget.style.setProperty("--my", e.clientY - r.top + "px");
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(90vmax circle at ${wash.x}px ${wash.y}px, color-mix(in srgb, ${wash.color} 20%, transparent), color-mix(in srgb, ${wash.color} 5%, transparent) 40%, transparent 70%)`,
          clipPath: `circle(${hover ? "150vmax" : "0px"} at ${wash.x}px ${wash.y}px)`,
          transition: "clip-path .7s var(--ease-out)",
        }}
      />

      <header className="relative flex items-center gap-2.5 px-[22px] py-[18px]" style={{ animation: `gfade ${dur}ms var(--ease-out) both` }}>
        <span translate="no" className="text-lg font-bold tracking-[-.02em] text-text">
          Backlog
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openSettings}
          title="Settings & admin"
          className="flex max-w-[230px] cursor-pointer items-center gap-[7px] rounded-lg border bg-topchip px-[11px] py-1.5 font-mono text-[11px] text-muted transition-[color,border-color,background] duration-250 hover:text-text"
          style={{ borderColor: chipBorder }}
        >
          <GearIcon />
          <span className="truncate">{user?.email}</span>
        </button>
        <button
          type="button"
          onClick={signOut}
          className="cursor-pointer rounded-[7px] border bg-topchip px-2.5 py-[7px] text-xs transition-[color,border-color,background-color,transform] duration-300 hover:bg-wc active:translate-y-px"
          style={{ color: pal || "var(--text)", borderColor: chipBorder }}
        >
          Sign out
        </button>
      </header>

      <main className="relative mx-auto flex w-full max-w-[1080px] flex-1 flex-col justify-center px-4 pt-4 pb-16 md:px-8">
        <div className="mb-7 md:mb-9">
          <div translate="no" className="g-rise mb-2 font-mono text-[12px] text-dim first-letter:uppercase" style={riseStyle(0)}>
            {date}
          </div>
          <h1 className="g-rise m-0 text-[34px] leading-none font-bold tracking-[-.035em] md:text-[46px]" style={riseStyle(1)}>
            {greeting(now.getHours())}
          </h1>
          <p className="g-rise mt-3 mb-0 text-[14px] text-muted" style={riseStyle(2)}>
            Pick up where you left off.
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 md:gap-3.5 lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(164px,auto))]" onKeyDown={moveFocus}>
          {ordered.map((l, i) => {
            const big = i === 0;
            const span = big ? { col: ordered.length === 1 ? 4 : 2, row: 2 } : spans[i - 1];
            // md is two columns: the big tile spans both, and so does a small tile left alone on the last row.
            const mdWide = big || (i === ordered.length - 1 && (ordered.length - 1) % 2 === 1);
            const delay = (i + 2) * step;
            return (
              <li
                key={l.key}
                className={[LG_COL[span.col as 1 | 2 | 4], span.row ? "lg:row-span-2" : "", mdWide ? "md:col-span-2" : ""].join(" ")}
                style={{ animation: `gtile ${dur}ms var(--ease-out) ${delay}ms both` }}
              >
                <Tile
                  lib={l}
                  big={big}
                  wide={!big && span.col === 4}
                  summary={memory.libs[l.key]}
                  iconDelay={delay + 160}
                  onEnter={(el) => enter(l, el)}
                  onLeave={() => setHover(null)}
                  onMove={spot}
                  onOpen={(e) => navigate(l.key, pointOf(e.currentTarget, e))}
                />
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function Tile({
  lib: l,
  big,
  wide,
  summary,
  iconDelay,
  onEnter,
  onLeave,
  onMove,
  onOpen,
}: {
  lib: LibraryDef;
  big: boolean;
  /** Alone on the last lg row: laid out in a line instead of a tall card. */
  wide: boolean;
  summary?: LibSummary;
  iconDelay: number;
  onEnter(el: HTMLElement): void;
  onLeave(): void;
  onMove(e: PointerEvent<HTMLElement>): void;
  onOpen(e: MouseEvent<HTMLElement>): void;
}) {
  const metrics = summary?.metrics.filter((m) => m.value) ?? [];
  const desc = l.key === "games" ? "Your backlog, stats & roulette" : l.desc;
  const [first, second] = metrics;

  return (
    <button
      type="button"
      data-tile={l.key}
      aria-label={"Open " + l.label}
      onMouseEnter={(e) => onEnter(e.currentTarget)}
      onFocus={(e) => onEnter(e.currentTarget)}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      onPointerMove={onMove}
      onClick={onOpen}
      className={
        "home-tile group relative isolate flex h-full w-full cursor-pointer overflow-hidden rounded-2xl border border-wf bg-card text-left transition-[transform,border-color] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:scale-[.99] " +
        // Small tiles are one line on phones, cards from md up, and one line again when alone on an lg row.
        (big
          ? "flex-col"
          : "flex-row items-center gap-4 py-4 pr-12 pl-[18px] md:flex-col md:items-start md:gap-0 md:px-5 md:pt-5 md:pb-[18px]" +
            (wide ? " lg:flex-row lg:items-center lg:gap-5 lg:pr-12" : ""))
      }
      style={{ "--tile": l.color, ...(big ? { padding: "26px 28px" } : {}) } as CSSProperties}
    >
      <span aria-hidden className="tile-glow" />
      <span aria-hidden className="tile-ring" />

      {/* Always the top-right corner, whatever the tile's layout. */}
      <span aria-hidden className={"absolute " + (big ? "top-[26px] right-[26px]" : "top-4 right-4")}>
        <ArrowUpRightIcon
          size={big ? 18 : 15}
          className="text-dim transition-[color,translate] duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--tile)"
        />
      </span>

      <div
        className="flex flex-none items-center justify-center rounded-xl transition-[scale] duration-300 ease-[var(--ease-out)] group-hover:scale-[1.06]"
        style={{
          width: big ? 52 : 42,
          height: big ? 52 : 42,
          color: LIBRARY_ICON_COLOR[l.key],
          background: `color-mix(in srgb, ${l.color} 14%, transparent)`,
          animation: `gpinpop 380ms var(--ease-spring) ${iconDelay}ms both`,
        }}
      >
        <LibraryIcon lib={l.key} size={big ? 27 : 22} />
      </div>

      <div className={big ? "mt-auto pt-7 md:pt-10" : "min-w-0 md:mt-auto md:w-full md:pt-6" + (wide ? " lg:mt-0 lg:w-auto lg:pt-0" : "")}>
        {big && (
          <div className="mb-1.5 font-mono text-[11px] font-semibold tracking-[.1em] uppercase" style={{ color: l.color }}>
            Continue
          </div>
        )}
        <div className={big ? "text-[30px] leading-none font-bold tracking-[-.03em] md:text-[34px]" : "text-[17px] font-bold tracking-[-.01em]"}>{l.label}</div>

        {big ? (
          <>
            <div className="mt-2 text-[13px] text-muted">{desc}</div>
            {metrics.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <div className="font-mono text-[26px] leading-none font-semibold tracking-[-.02em]" style={{ color: m.accent ? l.color : "var(--text)" }}>
                      <CountUp value={m.value} duration={700} />
                    </div>
                    <div className="mt-1.5 text-[11.5px] text-muted">{m.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 text-[12px] text-dim">Open to load your numbers</div>
            )}
            {summary?.note && <div className="mt-4 font-mono text-[11px] text-dim">{summary.note}</div>}
          </>
        ) : first ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[19px] leading-none font-semibold tracking-[-.02em]" style={{ color: first.accent ? l.color : "var(--text)" }}>
              <CountUp value={first.value} duration={700} />
            </span>
            <span className="text-[12px] text-muted">{first.label}</span>
            {second && (
              <span className="text-[12px] text-dim">
                <span translate="no">· {second.value}</span> {second.label}
              </span>
            )}
            {summary?.note && <div className="w-full truncate pt-1 font-mono text-[10.5px] text-dim">{summary.note}</div>}
          </div>
        ) : (
          <div className="mt-1 text-xs text-muted">{desc}</div>
        )}
      </div>
    </button>
  );
}
