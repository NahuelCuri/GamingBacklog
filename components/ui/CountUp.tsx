"use client";

// A formatted number ("142", "$1,234", "64%", "8.4") that counts up from its
// previous value (0 on mount). Anything else, or reduced motion, renders as is.
import { useLayoutEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

/** Short symbol prefix, the number, then a suffix without letters (so nothing needs translating). */
const NUM = /^([^\d\s-]{0,4})(-?[\d,]*\.?\d+)([^A-Za-z]*)$/;

interface Parsed {
  pre: string;
  n: number;
  dec: number;
  grouped: boolean;
  post: string;
}

function parse(text: string): Parsed | null {
  const m = NUM.exec(text);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { pre: m[1], n, dec: (m[2].split(".")[1] || "").length, grouped: m[2].includes(","), post: m[3] };
}

function format(p: Parsed, v: number) {
  const body = p.grouped
    ? v.toLocaleString("en-US", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec })
    : v.toFixed(p.dec);
  return p.pre + body + p.post;
}

export function CountUp({ value, duration = 600 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    // Write into React's own text node so later renders stay in sync with it.
    const node = ref.current?.firstChild;
    const p = parse(text);
    const from = shown.current ?? 0;
    if (!node || !p || from === p.n || reducedMotion()) {
      shown.current = p?.n ?? null;
      if (node) node.nodeValue = text;
      return;
    }
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / duration);
      const v = from + (p.n - from) * (1 - Math.pow(1 - t, 3));
      shown.current = v;
      node.nodeValue = t < 1 ? format(p, v) : text;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    node.nodeValue = format(p, from);
    raf = requestAnimationFrame(step);
    // React has already written the next value by the time this runs, so only stop the loop.
    return () => cancelAnimationFrame(raf);
  }, [text, duration]);

  return (
    <span ref={ref} translate="no" className="tabular-nums">
      {text}
    </span>
  );
}
