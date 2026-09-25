"use client";

import { useEffect, useState } from "react";
import { applyTheme, readTheme, type ThemeMode } from "@/lib/theme";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => setMode(readTheme()), []);

  const pick = (m: ThemeMode) => {
    applyTheme(m);
    setMode(m);
  };

  return (
    <div role="group" aria-label="Tema" className="flex rounded-lg border border-wf bg-inset p-0.5 text-xs font-semibold">
      {(["dark", "light"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => pick(m)}
          className="cursor-pointer rounded-md px-3 py-1.5 text-muted aria-pressed:bg-accent aria-pressed:text-on-accent"
        >
          {m === "dark" ? "Oscuro" : "Claro"}
        </button>
      ))}
    </div>
  );
}
