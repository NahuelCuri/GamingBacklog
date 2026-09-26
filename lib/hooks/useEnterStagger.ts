"use client";

import { useLayoutEffect, useRef } from "react";
import { play } from "@/lib/motion";

interface Options {
  /** Only the first `limit` positions animate; later ones just show. */
  limit?: number;
  /** Delay between consecutive new items, capped after `maxSteps`. */
  step?: number;
  maxSteps?: number;
  /** Leave whatever is there on mount alone; only animate items added later. */
  skipInitial?: boolean;
  keyframes?: Keyframe[];
  duration?: number;
}

const RISE: Keyframe[] = [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }];

/**
 * Fades in items the list didn't have on the previous render, in order.
 * Uses the Web Animations API so moving an element never restarts it.
 */
export function useEnterStagger(ids: string[], getEl: (id: string) => Element | null | undefined, opts: Options = {}) {
  const { limit = 24, step = 20, maxSteps = 12, skipInitial = false, keyframes = RISE, duration = 320 } = opts;
  const prev = useRef<Set<string> | null>(null);
  const sig = ids.join("\u0000");
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = new Set(ids);
    if (!before && skipInitial) return;
    let n = 0;
    ids.forEach((id, i) => {
      if (i >= limit || before?.has(id)) return;
      play(getEl(id), keyframes, { duration, delay: Math.min(n++, maxSteps) * step });
    });
    // ids is captured through sig; getEl and the options are read fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}
