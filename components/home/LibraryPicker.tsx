"use client";

// Post-login home: one card per visible library. Hovering a card tints the
// page from the nearest bottom corner in that library's colour.
import { useState } from "react";
import { GearIcon, LIBRARY_ICON_COLOR, LibraryIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { LIBRARIES, isTripMember, type LibraryKey } from "@/config/libraries";
import { useAuth } from "@/lib/auth";

const CLIP_POS: Record<LibraryKey, string> = {
  games: "6% 100%", books: "24% 100%", wines: "42% 100%", movies: "60% 100%", expenses: "78% 100%", trips: "96% 100%",
};
const GRAD_POS: Record<LibraryKey, string> = {
  games: "bottom left", books: "bottom center", wines: "bottom center", movies: "bottom center", expenses: "bottom center", trips: "bottom right",
};
const COLOR = Object.fromEntries(LIBRARIES.map((l) => [l.key, l.color])) as Record<LibraryKey, string>;

export function LibraryPicker() {
  const { libs, navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const [hover, setHover] = useState<LibraryKey | null>(null);
  const [lastHover, setLastHover] = useState<LibraryKey>("games");

  const cards = LIBRARIES.filter((l) => libs.includes(l.key) && (l.key !== "trips" || isTripMember(user?.id)));
  const pal = hover ? COLOR[hover] : null;
  const origin = hover || lastHover;
  const washBg = hover
    ? `radial-gradient(120% 120% at ${GRAD_POS[hover]}, color-mix(in srgb, ${pal} 26%, transparent), color-mix(in srgb, ${pal} 6%, transparent) 45%, transparent 72%)`
    : `color-mix(in srgb, ${COLOR[origin]} 0%, transparent)`;
  const pickerAccent = pal || "#59605b";
  const chipBorder = pal ? `color-mix(in srgb, ${pal} 45%, transparent)` : "var(--wd)";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: washBg,
          clipPath: `circle(${hover ? "160%" : "0%"} at ${CLIP_POS[origin]})`,
          transition: "clip-path .6s cubic-bezier(.22,1,.36,1), background .3s ease",
        }}
      />

      <header className="relative flex items-center gap-2.5 px-[22px] py-[18px]">
        <span translate="no" className="text-lg font-bold tracking-[-.02em] text-text">Backlog</span>
        <span className="font-mono text-[11px] transition-colors duration-300" style={{ color: pickerAccent }}>
          {"// choose a library"}
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

      <main className="relative flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[760px]">
          <div className="mb-1.5 font-mono text-[13px] transition-colors duration-250" style={{ color: pickerAccent }}>
            {"// what are we tracking today"}
          </div>
          <h1 className="mb-[22px] text-[26px] font-bold tracking-[-.02em]">Choose a library</h1>
          <ul className="grid gap-[14px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(166px, 1fr))" }}>
            {cards.map((l) => {
              const on = hover === l.key;
              return (
                <li key={l.key}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setHover(l.key);
                      setLastHover(l.key);
                    }}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => {
                      setHover(l.key);
                      setLastHover(l.key);
                    }}
                    onBlur={() => setHover(null)}
                    onClick={() => navigate(l.key)}
                    className="flex h-full w-full cursor-pointer flex-col gap-[14px] rounded-2xl border bg-card px-5 py-[22px] text-left transition-[border-color,transform] duration-200 active:scale-[.99]"
                    style={{ borderColor: on ? l.color : "var(--wf)", transform: on ? "translateY(-2px)" : "none" }}
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-[11px] transition-[filter,background] duration-250"
                      style={{
                        color: LIBRARY_ICON_COLOR[l.key],
                        background: on ? `color-mix(in srgb, ${l.color} 20%, transparent)` : "var(--wc)",
                        filter: on ? "none" : "grayscale(1) opacity(.6)",
                      }}
                    >
                      <LibraryIcon lib={l.key} />
                    </div>
                    <div>
                      <div className="text-[17px] font-bold tracking-[-.01em]">{l.label}</div>
                      <div className="mt-[3px] text-xs text-muted">{l.key === "games" ? "Your backlog, stats & roulette" : l.desc}</div>
                    </div>
                    <div className="mt-auto font-mono text-[11px] transition-colors duration-250" style={{ color: on ? l.color : "var(--dim)" }}>
                      Open →
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
