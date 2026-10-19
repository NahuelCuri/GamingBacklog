"use client";

// First-run tour of a trip board: a spotlight on one control at a time with a
// note beside it. Skip (or Escape) jumps to the last step, which points at the
// "?" button in the header that replays the tour.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDialog } from "@/lib/hooks/useDialog";
import { useTripCtx, type BoardTab } from "./TripPlanner";
import { Button, cx } from "./ui";

/** Set once the tour is finished, so it only starts by itself the first time (per device). */
export const TOUR_KEY = "bl_trips_tour";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // storage blocked: don't start it on every visit
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* private mode: it shows again next visit */
  }
}

interface TourStep {
  /** `data-tour` of the element to light up; none centres the note. */
  target?: string;
  /** The tab the step needs open. */
  tab?: BoardTab;
  title: string;
  /** One text node each, so the EN/ES translator swaps it whole. */
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  { title: "A quick tour", body: "Here’s how planning a trip works. You can skip it anytime." },
  { target: "new-card", tab: "cards", title: "Everything is a card", body: "Places, food, stays and plans each get a card, with a price, a time, a location and tags. Add one with New card." },
  { target: "card-tools", tab: "cards", title: "Compare and convert", body: "Compare puts cards side by side to help you choose. Convert changes prices between currencies." },
  { target: "pool", tab: "itinerary", title: "Sort cards into days", body: "Cards without a day wait in the pool. Drag them onto a day, or quick-add an idea from here." },
  { target: "tab-map", tab: "map", title: "See it on a map", body: "Cards with a location show up as pins, numbered in day order." },
  { target: "budget", title: "Watch the budget", body: "Card prices add up against the trip’s budget. The bar turns red when you go over." },
  { target: "share", title: "Plan together", body: "Invite people by email. They see and edit the same cards as you." },
  { target: "tour", title: "That’s it", body: "You can watch this tour again anytime with the ? button here, in the trip header." },
];

const PAD = 6, GAP = 14, MARGIN = 12;

type Box = { x: number; y: number; w: number; h: number };

/** Where the note goes: below the spotlight, else above, beside, or at the bottom of the screen. */
function placeNote(r: Box | null, pw: number, ph: number) {
  const W = innerWidth, H = innerHeight;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), W - pw - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), H - ph - MARGIN);
  if (!r) return { left: clampX((W - pw) / 2), top: clampY((H - ph) / 2) };
  const midX = clampX(r.x + r.w / 2 - pw / 2), midY = clampY(r.y + r.h / 2 - ph / 2);
  if (r.y + r.h + GAP + ph <= H - MARGIN) return { left: midX, top: r.y + r.h + GAP };
  if (r.y - GAP - ph >= MARGIN) return { left: midX, top: r.y - GAP - ph };
  if (r.x + r.w + GAP + pw <= W - MARGIN) return { left: r.x + r.w + GAP, top: midY };
  if (r.x - GAP - pw >= MARGIN) return { left: r.x - GAP - pw, top: midY };
  return { left: midX, top: H - ph - MARGIN };
}

export function TripTour({ onClose }: { onClose(): void }) {
  const { nav, setTab } = useTripCtx();
  const [i, setI] = useState(0);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;
  const startTab = useRef(nav.boardTab);
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // `animate` is off for the first placement, so the note doesn't slide in from off-screen.
  const [at, setAt] = useState<{ left: number; top: number; animate: boolean } | null>(null);

  const finish = () => {
    markTourSeen();
    if (nav.boardTab !== startTab.current) setTab(startTab.current);
    onClose();
  };
  const skip = () => setI(TOUR_STEPS.length - 1);
  useDialog(panel, last ? finish : skip, false);

  // Open the tab the step talks about.
  useEffect(() => {
    if (step.tab && step.tab !== nav.boardTab) setTab(step.tab);
  }, [step.tab, nav.boardTab, setTab]);

  // A new step is announced by moving focus to the note.
  useEffect(() => {
    if (i > 0) panel.current?.focus();
  }, [i]);

  useLayoutEffect(() => {
    const place = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      const r = el?.getBoundingClientRect();
      const b = r && (r.width || r.height) ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
      setBox(b);
      const pos = placeNote(b, panel.current?.offsetWidth ?? 320, panel.current?.offsetHeight ?? 160);
      setAt((p) => ({ ...pos, animate: !!p }));
    };
    place();
    // Again once the tab's entry animation has settled.
    const t = setTimeout(place, 220);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => {
      clearTimeout(t);
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [step.target, nav.boardTab]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] [animation:gfade_160ms_ease-out]">
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl shadow-[0_0_0_2px_var(--accent),0_0_0_9999px_rgba(0,0,0,.55)] transition-[left,top,width,height] duration-300 ease-[var(--ease-out)]"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/55" />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-tour-title"
        aria-describedby="tp-tour-body"
        tabIndex={-1}
        style={{ left: at?.left ?? -9999, top: at?.top ?? 0 }}
        className={cx("fixed w-[min(340px,calc(100vw-24px))] rounded-2xl border border-wh bg-surface p-4 shadow-[var(--shadow-pop)] outline-none", at?.animate && "transition-[left,top] duration-300 ease-[var(--ease-out)]")}
      >
        <div className="mb-2 flex gap-1" aria-hidden>
          {TOUR_STEPS.map((_, k) => (
            <span key={k} className={k <= i ? "h-1 flex-1 rounded-full bg-accent" : "h-1 flex-1 rounded-full bg-chip"} />
          ))}
        </div>
        <span className="sr-only">{`Step ${i + 1} of ${TOUR_STEPS.length}`}</span>
        <h2 id="tp-tour-title" className="m-0 text-base font-bold text-text">
          {step.title}
        </h2>
        <p id="tp-tour-body" className="mt-1.5 mb-4 text-13 text-pretty text-text2">
          {step.body}
        </p>
        <div className="flex items-center gap-2">
          {!last && (
            <Button size="sm" variant="ghost" onClick={skip} className="-ml-2">
              Skip tour
            </Button>
          )}
          <div className="flex-1" />
          {i > 0 && !last && (
            <Button size="sm" variant="secondary" onClick={() => setI(i - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={last ? finish : () => setI(i + 1)}>
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
