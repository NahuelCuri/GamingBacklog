"use client";

// One trip: header with dates and budget, then the Cards / Itinerary / Map tabs.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { CaretLeftIcon, DownloadIcon, PencilIcon, UsersIcon } from "@/components/icons";
import { CountUp } from "@/components/ui/CountUp";
import { Tick } from "@/components/ui/Tick";
import { downloadJson } from "@/lib/data/transfer";
import { budget, tripRange } from "@/lib/trips/model";
import { buildTripExport } from "@/lib/trips/transfer";
import { CardsTab } from "./CardsTab";
import { ItineraryTab } from "./ItineraryTab";
import { TripMap } from "./TripMap";
import { useTripCtx, type BoardTab } from "./TripPlanner";
import { IconButton, cx } from "./ui";

export function TripBoard() {
  const { data, access, trip, cards, isMobile: mob, nav, setTab, goHome, editTrip, openShare } = useTripCtx();
  const navRef = useRef<HTMLDivElement>(null);
  const tabEls = useRef(new Map<BoardTab, HTMLButtonElement>());
  // Underline under the active tab: a 1px bar moved and stretched with transform only.
  const [bar, setBar] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = tabEls.current.get(nav.boardTab);
      if (el) setBar((b) => ({ x: el.offsetLeft, w: el.offsetWidth, animate: !!b }));
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" && navRef.current ? new ResizeObserver(place) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    return () => ro?.disconnect();
  }, [nav.boardTab, cards, mob]);
  if (!trip) return null;
  const onExport = () => {
    const file = buildTripExport(data, trip.id);
    if (file) downloadJson(file.fileName, file.json);
  };
  const b = budget(trip, cards);
  const guests = access(trip.id).people.filter((p) => p.role !== "owner").length;
  const located = cards.filter((c) => c.loc && isFinite(c.loc.lat)).length;
  const planned = cards.filter((c) => c.day != null).length;
  const tabs: { k: BoardTab; label: string; badge: React.ReactNode; sr: string }[] = [
    { k: "cards", label: "Cards", badge: <Tick value={cards.length} />, sr: `${cards.length} ${cards.length === 1 ? "card" : "cards"}` },
    { k: "itinerary", label: "Itinerary", badge: <><Tick value={planned} />/{cards.length}</>, sr: `${planned} of ${cards.length} planned` },
    { k: "map", label: "Map", badge: <Tick value={located} />, sr: `${located} on the map` },
  ];
  // Arrow keys, Home and End move between the tabs (and open them).
  const onTabKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.k === nav.boardTab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const k = tabs[(next + tabs.length) % tabs.length].k;
    setTab(k);
    tabEls.current.get(k)?.focus();
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className={cx("flex shrink-0 items-center border-b border-wf bg-surface", mob ? "gap-3 px-4 py-3" : "gap-4 px-6 py-4")}>
        <IconButton tone="framed" onClick={goHome} aria-label="Back to all trips">
          <CaretLeftIcon size={16} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className={cx("m-0 truncate font-extrabold tracking-[-.01em] text-text", mob ? "text-base" : "text-xl")}>{trip.name}</h1>
            {!mob && <span className="shrink-0 rounded-md bg-chip2 px-2 py-0.5 font-mono text-2xs text-muted">{tripRange(trip)}</span>}
            <IconButton aria-label="Edit trip" title="Edit trip" onClick={() => editTrip(trip.id)} className="-ml-1">
              <PencilIcon size={13} />
            </IconButton>
            <IconButton aria-label="Export trip" title="Export trip (JSON)" onClick={onExport} className="-ml-2">
              <DownloadIcon size={13} />
            </IconButton>
            <IconButton aria-label={guests ? `Share trip, ${guests} ${guests === 1 ? "guest" : "guests"}` : "Share trip"} title="Share trip" onClick={openShare} className={cx("-ml-2", guests > 0 && "text-accent")}>
              <UsersIcon size={14} />
            </IconButton>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">{mob ? tripRange(trip) : trip.subtitle}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm tabular-nums">
            <span className={cx("font-semibold", b.overDisp ? "text-neg" : "text-text")}>
              <CountUp value={b.spentDisp} />
            </span>
            <span className="text-muted">{` / ${b.budgetDisp}`}</span>
          </div>
          <div className={cx("mt-1.5 ml-auto h-1.5 overflow-hidden rounded bg-chip", mob ? "w-24" : "w-44")} role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(parseFloat(b.pct))}>
            <div className="h-full origin-left [animation:ggrowx_560ms_var(--ease-out)_120ms_both]" style={{ width: b.pct, background: b.overDisp ? "var(--neg)" : "var(--accent)" }} />
          </div>
          {b.overDisp && <div className="mt-1 font-mono text-2xs text-neg tabular-nums">{`${b.overDisp} over budget`}</div>}
        </div>
      </header>

      <div ref={navRef} role="tablist" aria-label="Trip views" className={cx("relative flex shrink-0 gap-6 border-b border-wf bg-surface", mob ? "px-4" : "px-6")}>
        {tabs.map((t) => {
          const on = nav.boardTab === t.k;
          return (
            <button
              key={t.k}
              ref={(el) => {
                if (el) tabEls.current.set(t.k, el);
                else tabEls.current.delete(t.k);
              }}
              id={"tp-tab-" + t.k}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="tp-main"
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.k)}
              onKeyDown={onTabKey}
              className={cx("flex h-11 cursor-pointer items-center gap-2 text-sm transition-colors", on ? "font-bold text-text" : "font-semibold text-muted hover:text-text")}
            >
              {t.label}
              <span aria-hidden className={cx("rounded-md px-1.5 py-px font-mono text-2xs tabular-nums", on ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent2" : "bg-chip2 text-muted")}>
                {t.badge}
              </span>
              <span className="sr-only">{", " + t.sr}</span>
            </button>
          );
        })}
        {bar && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-accent"
            style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w})`, transition: bar.animate ? "transform 320ms var(--ease-out)" : "none" }}
          />
        )}
      </div>

      <main key={nav.boardTab} id="tp-main" role="tabpanel" aria-labelledby={"tp-tab-" + nav.boardTab} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none [animation:gfade_160ms_var(--ease-out)]">
        {nav.boardTab === "cards" && <CardsTab />}
        {nav.boardTab === "itinerary" && <ItineraryTab />}
        {nav.boardTab === "map" && <TripMap />}
      </main>
    </div>
  );
}
