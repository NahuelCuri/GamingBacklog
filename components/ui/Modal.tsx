"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Centered dialog over a blurred backdrop (legacy settings/modal look).
 * Closes on backdrop click and Escape, locks page scroll, and moves focus in.
 */
export function Modal({
  onClose,
  label,
  width = 470,
  children,
}: {
  onClose: () => void;
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 backdrop-blur-[3px]"
      style={{ background: "rgba(5,6,5,.66)", animation: "gfade .18s ease" }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="g-scroll max-h-[88vh] max-w-full overflow-y-auto rounded-2xl border border-wg bg-surface px-[26px] pt-[26px] pb-[22px] outline-none"
        style={{ width, animation: "gpop .22s cubic-bezier(.22,1,.36,1)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Small uppercase section label used across forms and settings. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"mb-[9px] text-[10px] font-semibold tracking-[.09em] text-dim uppercase " + className}>{children}</div>;
}

/** Pill switch (legacy toggle: 38×22 track, 18px white knob). */
export function Switch({ on, color }: { on: boolean; color?: string }) {
  return (
    <div
      aria-hidden
      className="relative h-[22px] w-[38px] shrink-0 rounded-[11px] transition-[background] duration-200"
      style={{ background: on ? color || "var(--accent)" : "var(--chip)" }}
    >
      <div className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-[left] duration-200" style={{ left: on ? 18 : 2 }} />
    </div>
  );
}
