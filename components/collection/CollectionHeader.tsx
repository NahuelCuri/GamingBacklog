"use client";

// Sticky collection top bar: brand (back to picker), view tabs, add, settings
// and an overflow menu with backup export/import and sign out.
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { DotsIcon, GearIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { Modal } from "@/components/ui/Modal";
import { Pill, PillGroup, accentButton, chipButton, secondaryButton } from "@/components/ui/Pills";
import { useAuth } from "@/lib/auth";
import type { Item } from "@/lib/collection/types";
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
  const [pendingImport, setPendingImport] = useState<Item[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
    setNotice("");
    setPendingImport(parsed.items);
  };

  const confirmImport = async () => {
    const items = pendingImport;
    setPendingImport(null);
    if (items && actions) await actions.importReplace(items);
  };

  const menu: MenuEntry[] = [
    { label: "Export", title: "Export backup (JSON)", disabled: !ready, onSelect: () => actions?.exportNow() },
    { label: "Import", title: "Import JSON", disabled: !ready, onSelect: () => fileInput.current?.click() },
    ...(isMobile ? [{ label: "Settings", onSelect: openSettings }] : []),
    { label: "Sign out", separated: true, onSelect: signOut },
  ];

  // The dialog renders beside the header: its backdrop-filter would otherwise
  // become the containing block of the dialog's fixed overlay.
  return (
    <>
      <header
        className="sticky top-0 z-(--z-sticky) border-b border-we backdrop-blur-[10px]"
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
  
          <div style={{ flex: 1 }} />
  
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
                className={chipButton + " flex max-w-[190px] items-center gap-1.5 py-1.5 font-mono text-[11px] not-disabled:hover:border-accent"}
              >
                <GearIcon size={12.5} />
                <span className="truncate">{user?.email}</span>
              </button>
            )}
            <OverflowMenu entries={menu} />
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-label="Import backup JSON file"
              tabIndex={-1}
              onChange={onImport}
              className="sr-only"
            />
          </div>
        </div>
        {notice && (
          <div role="alert" className="mx-auto max-w-[1180px] px-[26px] pb-3 text-xs text-neg">
            {notice}
          </div>
        )}
      </header>
      {pendingImport && (
        <Modal label="Replace library" onClose={() => setPendingImport(null)} width={420}>
          <h2 className="m-0 mb-2.5 text-[17px] font-semibold tracking-[-.01em] text-balance">
            Replace your {data.items.length} {cfg.nounPlural} with the {pendingImport.length} in this file?
          </h2>
          <p className="m-0 text-[13px] leading-[1.6] text-pretty text-muted2">A backup of the current data downloads first.</p>
          {isShared(collection) && (
            <p className="mt-2 mb-0 text-[13px] leading-[1.6] text-pretty text-neg">This library is shared: everyone&apos;s copy is replaced.</p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setPendingImport(null)} className={secondaryButton + " px-4 py-2 text-[13px]"}>
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmImport}
              className="cursor-pointer rounded-[9px] border-none bg-neg px-4 py-2 text-[13px] font-semibold text-on-accent transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[.98]"
            >
              Replace
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- overflow menu

interface MenuEntry {
  label: string;
  title?: string;
  disabled?: boolean;
  /** Draw a divider above this entry. */
  separated?: boolean;
  onSelect(): void;
}

/** "More" button with a small action menu: arrow keys move, Escape and outside clicks close. */
function OverflowMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const enabledItems = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []);

  useEffect(() => {
    if (!open) return;
    enabledItems()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const all = enabledItems();
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={chipButton + " flex items-center px-2 py-[6px]" + (open ? " border-wi text-text" : "")}
      >
        <DotsIcon size={16} />
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label="More actions"
          className="absolute top-[calc(100%+8px)] right-0 z-(--z-popover) min-w-[200px] rounded-[11px] border border-wg bg-card p-1"
          style={{ boxShadow: "var(--shadow-pop)", animation: "dpop .14s ease" }}
        >
          {entries.map((m) => (
            <div key={m.label} role="none">
              {m.separated && <div role="separator" className="mx-2 my-1 h-px bg-we" />}
              <button
                type="button"
                role="menuitem"
                title={m.title}
                disabled={m.disabled}
                onClick={() => {
                  close(false);
                  m.onSelect();
                }}
                className="block w-full cursor-pointer rounded-[7px] border-none bg-transparent px-3 py-2 text-left text-[13px] text-text2 transition-colors duration-150 hover:bg-wc hover:text-text focus-visible:bg-wc focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              >
                {m.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
