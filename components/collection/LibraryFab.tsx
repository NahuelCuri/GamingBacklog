"use client";

// Floating library switcher (bottom-right): the main button shows the current
// library; opening it fans out "All libraries" plus every visible library.
import { useState } from "react";
import { FabIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import type { LibraryKey } from "@/config/libraries";

const ITEMS: { key: LibraryKey | "_home"; label: string; color: string }[] = [
  { key: "_home", label: "All libraries", color: "#d6d8d6" },
  { key: "games", label: "Games", color: "#9ce6b0" },
  { key: "books", label: "Books", color: "#d8b98f" },
  { key: "wines", label: "Wines", color: "#c6a9d6" },
  { key: "movies", label: "Movies", color: "#a9aee0" },
  { key: "expenses", label: "Expenses", color: "#8ecfd6" },
];

const EASE = "cubic-bezier(.22,1,.36,1)";

export function LibraryFab({ current }: { current: LibraryKey }) {
  const { libs, navigate } = useShell();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((d) => d.key === "_home" || libs.includes(d.key) || d.key === current);

  return (
    <div
      className="fixed z-[300] flex flex-col-reverse items-center gap-3"
      style={{ right: "max(env(safe-area-inset-right, 0px), 22px)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch library"
        aria-label="Switch library"
        aria-expanded={open}
        className="flex h-[54px] w-[54px] cursor-pointer items-center justify-center rounded-full text-accent"
        style={{
          background: "#141210",
          boxShadow: "0 6px 20px rgba(0,0,0,.5)",
          border: "1.5px solid color-mix(in srgb, var(--accent) 45%, transparent)",
          transition: `transform .3s ${EASE}`,
          transform: open ? "rotate(90deg)" : "none",
        }}
      >
        <FabIcon name={open ? "_close" : current} size={24} />
      </button>
      {items.map((d, i) => {
        const delay = (open ? i : items.length - 1 - i) * 45;
        return (
          <button
            key={d.key}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            title={d.label}
            aria-label={d.label}
            onClick={() => {
              setOpen(false);
              navigate(d.key === "_home" ? null : d.key);
            }}
            className="flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full"
            style={{
              background: "#141210",
              color: d.color,
              boxShadow: "0 4px 14px rgba(0,0,0,.45)",
              border: d.key === current ? `2px solid ${d.color}` : "1.5px solid var(--wg)",
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(.4)",
              pointerEvents: open ? "auto" : "none",
              transition: `opacity .3s ${EASE} ${delay}ms, transform .3s ${EASE} ${delay}ms`,
            }}
          >
            <FabIcon name={d.key} />
          </button>
        );
      })}
    </div>
  );
}
