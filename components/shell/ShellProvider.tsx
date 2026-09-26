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
  const [wipe, setWipe] = useState<{ phase: WipePhase; target: LibraryKey | null; from?: WipeOrigin }>({ phase: null, target: null });
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
      if (prefersReducedMotion()) {
        router.push(hrefOf(target));
        return;
      }
      setWipe({ phase: "cover", target, from });
      timers.current.forEach(clearTimeout);
      timers.current = [
        window.setTimeout(() => {
          router.push(hrefOf(target));
          setWipe({ phase: "reveal", target, from });
        }, WIPE_MS),
        window.setTimeout(() => setWipe({ phase: null, target: null }), WIPE_MS * 2),
      ];
    },
    [wipe.phase, current, router],
  );

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
      <WipeOverlay phase={wipe.phase} target={wipe.target} from={wipe.from} light={themeMode === "light"} />
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
 */
function WipeOverlay({ phase, target, from, light }: { phase: WipePhase; target: LibraryKey | null; from?: WipeOrigin; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (!phase) return el.getAnimations().forEach((a) => a.cancel());
    if (!from) return;
    if (phase === "cover") {
      const r = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
      const at = `at ${from.x}px ${from.y}px`;
      el.animate([{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${r}px ${at})` }], { duration: WIPE_MS, easing: "cubic-bezier(.66,0,.34,1)", fill: "forwards" });
    } else {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: WIPE_MS, easing: "ease-out", fill: "forwards" });
    }
  }, [phase, from]);
  const theme = target && isCollectionKey(target) ? COLLECTIONS[target].theme : null;
  const fill = light ? "#f2f4ef" : theme?.bg || "#0d0f0e";
  const bar = light ? "#e6e9e3" : "#050605";
  const accent = !target ? (light ? "#7c847e" : "#d6d8d6") : theme?.accent || LIBRARIES.find((l) => l.key === target)!.color;
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
