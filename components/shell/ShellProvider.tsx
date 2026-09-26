"use client";

// App shell state shared by the home picker and every collection page:
// visible libraries, theme mode, the Settings modal, and page switching with
// the legacy colour-wipe transition.
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { COLLECTIONS, isCollectionKey } from "@/config/collections";
import { LIBRARIES, LIBRARY_KEYS, type LibraryKey } from "@/config/libraries";
import { useAuth } from "@/lib/auth";
import { loadVisibleLibs, saveVisibleLibs, toggleLib as toggleLibPure } from "@/lib/prefs";
import { rememberLast } from "@/lib/home";
import { applyTheme, readTheme, type ThemeMode } from "@/lib/theme";
import { SettingsModal } from "@/components/settings/SettingsModal";

const WIPE_MS = 430;
/** Back to home from a library: fade in its background, then close it into the library's home tile. */
const INTO_COVER_MS = 180;
const INTO_CLOSE_MS = 520;
/** Longest the cover waits for the new route before revealing anyway. */
const MAX_WAIT_MS = 4000;

type WipePhase = null | "cover" | "reveal";
/** Viewport point a circular wipe grows from (a home tile); without it the bar wipe runs. */
export type WipeOrigin = { x: number; y: number };

interface ShellContextValue {
  /** Library of the current route, or null on the home picker. */
  current: LibraryKey | null;
  libs: LibraryKey[];
  toggleLib(key: LibraryKey): void;
  themeMode: ThemeMode;
  setThemeMode(m: ThemeMode): void;
  settingsOpen: boolean;
  openSettings(): void;
  closeSettings(): void;
  /** Go to a library (null = home) behind the wipe overlay; `from` makes it a circle grown from that point. */
  navigate(target: LibraryKey | null, from?: WipeOrigin): void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

const hrefOf = (k: LibraryKey | null) => (k ? `/${k}/` : "/");

export function libraryFromPath(pathname: string | null): LibraryKey | null {
  const seg = (pathname || "/").split("/").filter(Boolean)[0];
  return seg && (LIBRARY_KEYS as string[]).includes(seg) ? (seg as LibraryKey) : null;
}

/** The Trip Planner's own background (components/trips/styles). */
const TRIPS_BG = "#0c0e0f";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = libraryFromPath(pathname);
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [libs, setLibs] = useState<LibraryKey[]>(LIBRARY_KEYS);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wipe, setWipe] = useState<{ phase: WipePhase; target: LibraryKey | null; from?: WipeOrigin; into?: LibraryKey; pushed?: boolean }>({
    phase: null,
    target: null,
  });
  const timers = useRef<number[]>([]);

  useEffect(() => setThemeModeState(readTheme()), []);

  // Load the user's library visibility; open the only library right after sign-in.
  const autoOpened = useRef<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    const next = loadVisibleLibs(localStorage, uid);
    setLibs(next);
    if (autoOpened.current !== uid) {
      autoOpened.current = uid;
      if (next.length === 1 && !current) router.replace(hrefOf(next[0]));
    }
  }, [uid, current, router]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The home page's big tile is the library opened last (this device only).
  useEffect(() => {
    if (current) rememberLast(uid, current);
  }, [uid, current]);

  const navigate = useCallback(
    (target: LibraryKey | null, from?: WipeOrigin) => {
      if (wipe.phase || target === current) return;
      const href = hrefOf(target);
      if (prefersReducedMotion()) {
        router.push(href);
        return;
      }
      timers.current.forEach(clearTimeout);
      router.prefetch?.(href);
      // Library → home is the reverse of opening a tile: the colour closes back into it.
      const into = target === null && current && !from ? current : undefined;
      const cover = into ? INTO_COVER_MS : WIPE_MS;
      setWipe({ phase: "cover", target, from, into });
      timers.current = [
        window.setTimeout(() => {
          router.push(href);
          setWipe((w) => ({ ...w, pushed: true }));
        }, cover),
        // Never leave the cover up if the route doesn't change.
        window.setTimeout(() => setWipe((w) => (w.phase === "cover" ? { ...w, phase: "reveal" } : w)), cover + MAX_WAIT_MS),
      ];
    },
    [wipe.phase, current, router],
  );

  // Reveal once the new route is on screen rather than on a timer: a page slower
  // than the wipe would otherwise show the old one again under the fading cover.
  useEffect(() => {
    if (wipe.phase === "cover" && wipe.pushed && current === wipe.target) setWipe((w) => ({ ...w, phase: "reveal" }));
  }, [wipe.phase, wipe.pushed, wipe.target, current]);

  useEffect(() => {
    if (wipe.phase !== "reveal") return;
    // The close into a tile waits a few frames for the home tiles, hence the slack.
    const t = window.setTimeout(() => setWipe({ phase: null, target: null }), wipe.into ? INTO_CLOSE_MS + 300 : WIPE_MS);
    return () => clearTimeout(t);
  }, [wipe.phase, wipe.into]);

  const value = useMemo<ShellContextValue>(
    () => ({
      current,
      libs,
      toggleLib(key) {
        const next = toggleLibPure(libs, key);
        if (!next) return;
        setLibs(next);
        saveVisibleLibs(localStorage, uid, next);
      },
      themeMode,
      setThemeMode(m) {
        applyTheme(m);
        setThemeModeState(m);
      },
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      navigate,
    }),
    [current, libs, uid, themeMode, settingsOpen, navigate],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      {settingsOpen && <SettingsModal />}
      <WipeOverlay phase={wipe.phase} target={wipe.target} from={wipe.from} into={wipe.into} light={themeMode === "light"} />
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}

/**
 * A thin dark bar leads while the new page's background colour fills in behind it.
 * From a home tile (`from`), the colour instead grows as a circle from that point and fades off the new page.
 * Back to home (`into`), the library's colour covers the page and then closes into that library's tile.
 */
function WipeOverlay({ phase, target, from, into, light }: { phase: WipePhase; target: LibraryKey | null; from?: WipeOrigin; into?: LibraryKey; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (!phase) return el.getAnimations().forEach((a) => a.cancel());
    if (into) {
      if (phase === "cover") {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: INTO_COVER_MS, easing: "ease-out", fill: "forwards" });
        return;
      }
      // The home page may take a frame or two to mount its tiles.
      let raf = 0;
      let tries = 0;
      const close = () => {
        const tile = document.querySelector(`[data-tile="${into}"]`);
        if (!tile && tries++ < 30) {
          raf = requestAnimationFrame(close);
          return;
        }
        if (!tile) {
          el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-out", fill: "forwards" });
          return;
        }
        const r = tile.getBoundingClientRect();
        const box = `${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px`;
        el.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: `inset(${box} round 16px)` }], {
          duration: INTO_CLOSE_MS,
          easing: "cubic-bezier(.65,0,.25,1)",
          fill: "forwards",
        });
        // Hand over to the tile as the shape lands on it.
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: INTO_CLOSE_MS - 120, easing: "ease-out", fill: "forwards" });
      };
      close();
      return () => cancelAnimationFrame(raf);
    }
    if (!from) return;
    if (phase === "cover") {
      const r = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
      const at = `at ${from.x}px ${from.y}px`;
      el.animate([{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${r}px ${at})` }], { duration: WIPE_MS, easing: "cubic-bezier(.66,0,.34,1)", fill: "forwards" });
    } else {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: WIPE_MS, easing: "ease-out", fill: "forwards" });
    }
  }, [phase, from, into]);
  const theme = target && isCollectionKey(target) ? COLLECTIONS[target].theme : null;
  const fill = light ? "#f2f4ef" : theme?.bg || "#0d0f0e";
  const bar = light ? "#e6e9e3" : "#050605";
  const accent = !target ? (light ? "#7c847e" : "#d6d8d6") : theme?.accent || LIBRARIES.find((l) => l.key === target)!.color;
  if (into) {
    const source = isCollectionKey(into) ? COLLECTIONS[into].theme.bg : TRIPS_BG;
    return (
      <div
        ref={ref}
        aria-hidden
        style={{
          // Home is usable while the colour closes into its tile.
          position: "fixed", inset: 0, zIndex: "var(--z-wipe)", pointerEvents: phase === "cover" ? "auto" : "none",
          transform: phase ? "none" : "translateX(-101%)", opacity: 0, background: light ? "#f2f4ef" : source,
        }}
      />
    );
  }
  if (from) {
    return (
      <div
        ref={ref}
        aria-hidden
        style={{
          position: "fixed", inset: 0, zIndex: "var(--z-wipe)", pointerEvents: phase ? "auto" : "none",
          transform: phase ? "none" : "translateX(-101%)",
          background: `radial-gradient(circle at ${from.x}px ${from.y}px, color-mix(in srgb, ${accent} 16%, ${fill}), ${fill} 55%)`,
        }}
      />
    );
  }
  const tx = phase === "cover" ? "0" : phase === "reveal" ? "101%" : "-101%";
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: "var(--z-wipe)", pointerEvents: phase ? "auto" : "none", willChange: "transform",
        transform: `translateX(${tx})`, transition: phase ? `transform ${WIPE_MS}ms cubic-bezier(.66,0,.34,1)` : "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: fill }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 52, background: bar, boxShadow: `-1px 0 0 ${accent}` }} />
    </div>
  );
}
