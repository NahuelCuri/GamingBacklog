"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour: Escape closes, Tab stays inside, the first field (or
 * the panel) gets focus, page scroll is locked, and focus returns on close.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, focusFirstField = true) {
  // Latest onClose without re-running the effect (which would steal focus again).
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const first = focusFirstField ? root.querySelector<HTMLElement>("input,textarea,button") : null;
      (first ?? root).focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;
      const f = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null && !el.closest("[inert]"),
      );
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [ref, focusFirstField]);
}
