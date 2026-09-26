"use client";

import { useEffect, useState } from "react";

/** Legacy breakpoint: phones and narrow windows. */
export const MOBILE_QUERY = "(max-width: 720px)";

/** The Trip Planner switches layout a little later (legacy: innerWidth < 760). */
export const TRIPS_MOBILE_QUERY = "(max-width: 759px)";

export function useIsMobile(query = MOBILE_QUERY): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    setMobile(mql.matches);
    const on = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return mobile;
}
