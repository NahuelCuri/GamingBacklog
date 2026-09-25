"use client";

import { useEffect, useState } from "react";

/** Legacy breakpoint: phones and narrow windows. */
export const MOBILE_QUERY = "(max-width: 720px)";

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(MOBILE_QUERY);
    if (!mql) return;
    setMobile(mql.matches);
    const on = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return mobile;
}
