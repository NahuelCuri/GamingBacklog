"use client";

// Fixed EN/ES switch (bottom-left, every page), as in legacy. The choice is per
// device (localStorage `bl_lang`) and translates the page in place.
import { useEffect, useRef, useState } from "react";
import { ES } from "@/lib/i18n/es";
import { ES_ADDED } from "@/lib/i18n/es-added";
import { createTranslator, readLang, saveLang, type Lang, type Translator } from "@/lib/i18n/translator";

export function LanguageToggle() {
  const [lang, setLang] = useState<Lang>("en");
  const translator = useRef<Translator | null>(null);

  useEffect(() => {
    // Starts after hydration so React never sees translated markup.
    const t = createTranslator(document.body, { ...ES, ...ES_ADDED });
    translator.current = t;
    const saved = readLang();
    t.setLang(saved);
    setLang(saved);
    return () => {
      t.setLang("en");
      t.stop();
    };
  }, []);

  const choose = (l: Lang) => {
    saveLang(l);
    setLang(l);
    translator.current?.setLang(l);
  };

  return (
    <div
      data-no-i18n=""
      role="group"
      aria-label="Language / Idioma"
      title="Language / Idioma"
      className="fixed z-(--z-lang) flex select-none gap-[2px] rounded-[9px] bg-topchip p-[3px] font-mono text-[11px]"
      style={{
        left: "max(env(safe-area-inset-left, 0px), 16px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        border: "1px solid var(--wh)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => choose(l)}
          className="cursor-pointer rounded-md border-none px-2.5 py-[5px] transition-[color,background] duration-200"
          style={{
            color: lang === l ? "var(--bg)" : "var(--muted)",
            background: lang === l ? "var(--accent)" : "transparent",
            fontWeight: lang === l ? 700 : 500,
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
