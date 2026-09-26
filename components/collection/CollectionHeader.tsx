"use client";

// Sticky collection top bar: brand (back to picker), view tabs, backup
// export/import, add, settings and sign out.
import { useState, type ChangeEvent } from "react";
import { GearIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { Pill, PillGroup, accentButton, chipButton } from "@/components/ui/Pills";
import { useAuth } from "@/lib/auth";
import { hasView, type CollectionView } from "@/lib/collection/url-state";
import { canTransfer } from "@/lib/data/collection-state";
import { isShared } from "@/lib/data/store";
import { parseImport } from "@/lib/data/transfer";
import { useCollectionCtx } from "./CollectionContext";

export function CollectionHeader() {
  const { cfg, collection, data, actions, currency, isMobile, url, setUrl, openAdd } = useCollectionCtx();
  const { navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const [notice, setNotice] = useState("");
  const ready = canTransfer(data);

  const tabs: { view: CollectionView; label: string }[] = [
    { view: "library", label: cfg.libraryLabel || "Library" },
    { view: "stats", label: "Stats" },
    { view: "months", label: cfg.months?.label || "Months" },
    { view: "map", label: "Map" },
    { view: "roulette", label: "Roulette" },
  ];

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !actions || !ready) return;
    const parsed = parseImport(await file.text(), cfg);
    if (!parsed.ok) {
      setNotice(parsed.error);
      return;
    }
    const shared = isShared(collection) ? "\n\nThis library is shared: everyone's copy is replaced." : "";
    const ok = confirm(
      `Replace your ${data.items.length} ${cfg.nounPlural} with the ${parsed.items.length} in this file?\n\nA backup of the current data downloads first.${shared}`,
    );
    if (!ok) return;
    await actions.importReplace(parsed.items);
    setNotice("");
  };

  return (
    <header
      className="sticky top-0 z-20 border-b border-we backdrop-blur-[10px]"
      style={{ background: "color-mix(in srgb, var(--bg) 86%, transparent)" }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-[18px]" style={{ padding: isMobile ? "12px 14px" : "14px 26px" }}>
        <h1 className="m-0 text-lg font-bold tracking-[-.02em]">
          <button
            type="button"
            onClick={() => navigate(null)}
            title="All libraries"
            aria-label="All libraries"
            className="flex cursor-pointer items-baseline gap-2.5 border-none bg-transparent p-0 text-inherit"
          >
            <span translate="no">{cfg.brand}</span>
            <span className="font-mono text-[11px] font-normal text-dim">{cfg.kicker}</span>
          </button>
        </h1>

        <PillGroup role="tablist" label="Views" style={{ flex: isMobile ? "1 1 100%" : "0 0 auto", order: isMobile ? 3 : 0 }}>
          {tabs
            .filter((t) => hasView(cfg, t.view))
            .map((t) => (
              <Pill
                key={t.view}
                tab
                active={url.view === t.view}
                onClick={() => setUrl({ view: t.view })}
                className="px-[14px] py-1.5 text-[13px] font-semibold"
                style={{ flex: isMobile ? 1 : "0 0 auto", textAlign: isMobile ? "center" : "left" }}
              >
                {t.label}
              </Pill>
            ))}
        </PillGroup>

        <div style={{ flex: isMobile ? "0 0 0" : 1 }} />

        {currency && (
          <PillGroup label="Display currency (live rate)">
            {(["base", "alt"] as const).map((c) => (
              <Pill
                key={c}
                active={currency.choice === c}
                onClick={() => currency.setChoice(c)}
                aria-label={"Show amounts in " + (c === "base" ? currency.cfg.base : currency.cfg.alt)}
                className="px-[11px] py-1.5 font-mono text-xs font-semibold"
              >
                {c === "base" ? currency.cfg.baseSymbol : currency.cfg.altSymbol}
              </Pill>
            ))}
          </PillGroup>
        )}

        <button type="button" onClick={() => actions?.exportNow()} disabled={!ready} title="Export backup (JSON)" className={chipButton}>
          Export
        </button>
        <label title="Import JSON" className={chipButton + (ready ? "" : " pointer-events-none opacity-50")}>
          Import
          <input type="file" accept="application/json,.json" aria-label="Import backup JSON file" onChange={onImport} className="absolute h-px w-px opacity-0" />
        </label>
        <button type="button" onClick={openAdd} className={accentButton + " px-4 py-[9px] text-[13px]"}>
          {cfg.addLabel}
        </button>

        <div className="ml-[2px] flex items-center gap-2 border-l border-wf pl-3">
          {!isMobile && (
            <button
              type="button"
              onClick={openSettings}
              title="Settings & admin"
              aria-label="Settings and admin"
              className="flex max-w-[190px] cursor-pointer items-center gap-1.5 rounded-lg border border-wf bg-topchip px-2.5 py-1.5 font-mono text-[11px] text-muted transition-[color,border-color] duration-200 hover:border-accent hover:text-text"
            >
              <GearIcon size={12.5} />
              <span className="truncate">{user?.email}</span>
            </button>
          )}
          <button type="button" onClick={signOut} title="Sign out" className={chipButton}>
            Sign out
          </button>
        </div>
      </div>
      {notice && (
        <div role="alert" className="mx-auto max-w-[1180px] px-[26px] pb-3 text-xs text-[#d98f8f]">
          {notice}
        </div>
      )}
    </header>
  );
}
