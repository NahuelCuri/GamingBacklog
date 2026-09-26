"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_URL_STATE, readUrlState, sameUrlState, writeUrlState, type UrlState } from "@/lib/collection/url-state";

/**
 * Collection view + filters mirrored to the query string. Typing replaces the
 * history entry; switching view pushes one, so Back returns to the previous view.
 */
export function useUrlState() {
  const [state, setState] = useState<UrlState>(DEFAULT_URL_STATE);
  const prev = useRef<UrlState | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = readUrlState(location.search);
      prev.current = s;
      setState(s);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    // The first commit still holds the defaults (the URL is read in the effect
    // above); writing them back would wipe the incoming query string.
    if (state === DEFAULT_URL_STATE) return;
    const before = prev.current;
    if (!before || sameUrlState(before, state)) return;
    prev.current = state;
    const url = location.pathname + writeUrlState(location.search, state) + location.hash;
    if (url === location.pathname + location.search + location.hash) return;
    if (before.view !== state.view) history.pushState(history.state, "", url);
    else history.replaceState(history.state, "", url);
  }, [state]);

  const update = useCallback((patch: Partial<UrlState> | ((s: UrlState) => Partial<UrlState>)) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  return [state, update] as const;
}
