"use client";

// A small value (a count) that nudges up and back when it changes. Not on mount.
import { useEffect, useRef, type ReactNode } from "react";
import { play } from "@/lib/motion";

export function Tick({ value, children }: { value: string | number; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    play(ref.current, [{ transform: "none" }, { opacity: 0.5, transform: "translateY(-3px)", offset: 0.4 }, { opacity: 1, transform: "none" }], { duration: 220 });
  }, [value]);
  return (
    <span ref={ref} className="inline-block">
      {children ?? value}
    </span>
  );
}
