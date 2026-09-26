"use client";

import { useEffect, useState } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";

/** Live prefers-reduced-motion. False on the server and first render. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mql) return;
    setReduced(mql.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return reduced;
}
