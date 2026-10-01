"use client";

// Sticky collection top bar: brand (back to picker), view tabs, add, settings
// and an overflow menu with backup export/import and sign out.
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { COLLECTION_KEYS } from "@/config/collections";
import { LIBRARIES } from "@/config/libraries";
import { DotsIcon, GearIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { Modal } from "@/components/ui/Modal";
import { Pill, PillGroup, accentButton, chipButton, secondaryButton } from "@/components/ui/Pills";
import { useAuth } from "@/lib/auth";
import type { CollectionConfig, CollectionKey, Item } from "@/lib/collection/types";
import { hasView, type CollectionView } from "@/lib/collection/url-state";
import { canTransfer } from "@/lib/data/collection-state";
import { isShared, supabaseStore } from "@/lib/data/store";
import { buildExports, diffImport, downloadAll, parseImport } from "@/lib/data/transfer";
import { errorMessage, getSupabase } from "@/lib/supabase";
import { useCollectionCtx } from "./CollectionContext";

export function CollectionHeader() {
  const { cfg, collection, data, actions, currency, isMobile, url, setUrl, openAdd } = useCollectionCtx();
  const { navigate, openSettings, libs } = useShell();
  const { user, signOut } = useAuth();
  const [notice, setNotice] = useState("");
  const [pendingImport, setPendingImport] = useState<Item[] | null>(null);
  const [exporting, setExporting] = useState(false);
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

  const confirmImport = async (mode: ImportMode) => {
    const items = pendingImport;
    setPendingImport(null);
    if (!items || !actions) return;
    await (mode === "merge" ? actions.importMerge(items) : actions.importReplace(items));
  };

  const menu: MenuEntry[] = [
    { label: "Export", title: "Export backup (JSON)", disabled: !ready, onSelect: () => setExporting(true) },
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
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center" style={{ padding: isMobile ? "12px 14px" : "14px 26px", gap: isMobile ? "12px 10px" : 18 }}>
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
  
          {/* Short on phones so the row never wraps ("+ Add transaction" pushed the menu to a second line). */}
          <button type="button" onClick={openAdd} className={accentButton + " px-4 py-[9px] text-[13px]"}>
            {isMobile ? "+ Add" : cfg.addLabel}
          </button>
  
          <div className={"flex items-center gap-2" + (isMobile ? "" : " ml-[2px] border-l border-wf pl-3")}>
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
      {exporting && (
        <ExportDialog
          current={collection}
          libs={libs}
          onClose={() => setExporting(false)}
          load={async (key) => {
            // The open library exports what is on screen; the others are read fresh.
            if (key === collection) return data.items;
            const sb = getSupabase();
            if (!sb || !user) throw new Error("Sign in to export other libraries.");
            return supabaseStore(sb, key, user.id).load();
          }}
        />
      )}
      {pendingImport && (
        <ImportDialog
          current={data.items}
          incoming={pendingImport}
          cfg={cfg}
          shared={isShared(collection)}
          onConfirm={confirmImport}
          onClose={() => setPendingImport(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- import dialog

type ImportMode = "merge" | "replace";

/** Confirms an import, adding to the library by default or replacing it on request. */
function ImportDialog({
  current,
  incoming,
  cfg,
  shared,
  onConfirm,
  onClose,
}: {
  current: Item[];
  incoming: Item[];
  cfg: CollectionConfig;
  shared: boolean;
  onConfirm: (mode: ImportMode) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ImportMode>("merge");
  const diff = useMemo(() => diffImport(current, incoming), [current, incoming]);
  const { added, changed, unchanged, removed } = diff;
  const noun = cfg.nounPlural;

  const options: { mode: ImportMode; label: string; detail: string }[] = [
    { mode: "merge", label: "Add to library", detail: "Adds the new ones and updates the changed ones. Nothing is deleted." },
    {
      mode: "replace",
      label: "Replace everything",
      detail: `Your library becomes exactly the file: ${removed.length} ${noun} not in it are deleted.`,
    },
  ];

  const title = (g: Item) => String(g[cfg.modal.titleField] || g.id);
  const labels = useMemo(() => new Map(cfg.modal.groups.flatMap((gr) => gr.fields.map((f) => [f.key, f.label] as const))), [cfg]);
  const show = (v: unknown) => {
    if (v === undefined || v === null || v === "") return "—";
    const t = typeof v === "object" ? JSON.stringify(v) : String(v);
    return t.length > 28 ? t.slice(0, 27) + "…" : t;
  };

  return (
    <Modal label="Import backup" onClose={onClose} width={480}>
      <h2 className="m-0 mb-1 text-[17px] font-semibold tracking-[-.01em] text-balance">
        Import {incoming.length} {noun}
      </h2>
      <p className="m-0 mb-3.5 font-mono text-xs text-muted2">
        <span className="text-accent">+{added.length} new</span> · <span className="text-text">~{changed.length} changed</span> · {unchanged} unchanged
        {mode === "replace" && <span className="text-neg"> · −{removed.length} deleted</span>}
      </p>

      <div role="radiogroup" aria-label="Import mode" className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label
            key={o.mode}
            className={
              "flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition-colors duration-150 " +
              (mode === o.mode ? (o.mode === "replace" ? "border-neg/45 bg-neg/6" : "border-wi bg-wc") : "border-we hover:bg-wc")
            }
          >
            <input
              type="radio"
              name="import-mode"
              checked={mode === o.mode}
              onChange={() => setMode(o.mode)}
              className={"mt-[3px] size-4 cursor-pointer " + (o.mode === "replace" ? "accent-(--neg)" : "accent-(--accent)")}
            />
            <span>
              <span className="block text-[13.5px] font-semibold text-text">{o.label}</span>
              <span className="mt-0.5 block text-xs leading-[1.5] text-pretty text-muted2">{o.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="g-scroll mt-3 max-h-[240px] overflow-y-auto rounded-[10px] border border-we">
        <DiffSection label="New" tone="text-accent" count={added.length} open={added.length > 0 && added.length <= 10}>
          {added.map((g) => (
            <li key={g.id}>{title(g)}</li>
          ))}
        </DiffSection>
        <DiffSection label="Changed (the file's version wins)" tone="text-text" count={changed.length} open={changed.length > 0}>
          {changed.map(({ before, after, fields }) => (
            <li key={after.id}>
              <span className="text-text">{title(after)}</span>
              <span className="block text-muted">
                {fields.map((k, i) => (
                  <span key={k}>
                    {i > 0 && " · "}
                    {labels.get(k) || k}: <span className="line-through opacity-70">{show(before[k])}</span> → {show(after[k])}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </DiffSection>
        {mode === "replace" && (
          <DiffSection label="Deleted" tone="text-neg" count={removed.length} open={removed.length > 0 && removed.length <= 10}>
            {removed.map((g) => (
              <li key={g.id}>{title(g)}</li>
            ))}
          </DiffSection>
        )}
      </div>

      <p className="mt-3 mb-0 text-xs leading-[1.6] text-pretty text-muted2">A backup of the current data downloads first.</p>
      {shared && mode === "replace" && (
        <p className="mt-2 mb-0 text-xs leading-[1.6] text-pretty text-neg">This library is shared: everyone&apos;s copy is replaced.</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton + " px-4 py-2 text-[13px]"}>
          Cancel
        </button>
        {mode === "merge" ? (
          <button type="button" onClick={() => onConfirm("merge")} className={accentButton + " px-4 py-2 text-[13px]"}>
            Import
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onConfirm("replace")}
            className="cursor-pointer rounded-[9px] border-none bg-neg px-4 py-2 text-[13px] font-semibold text-on-accent transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[.98]"
          >
            Replace
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Collapsible list in the import diff; empty sections render as a plain count. */
function DiffSection({ label, tone, count, open, children }: { label: string; tone: string; count: number; open: boolean; children: ReactNode }) {
  const head = (
    <>
      <span className={"font-mono " + tone}>{count}</span> <span>{label}</span>
    </>
  );
  if (!count) return <div className="border-b border-we px-3 py-2 text-xs text-muted last:border-b-0">{head}</div>;
  return (
    <details open={open} className="border-b border-we text-xs last:border-b-0">
      <summary className="cursor-pointer px-3 py-2 text-text2 select-none hover:bg-wc">{head}</summary>
      <ul className="m-0 flex list-none flex-col gap-1.5 px-3 pt-0.5 pb-2.5 leading-[1.45] text-text2">{children}</ul>
    </details>
  );
}

// ---------------------------------------------------------------- export dialog

/** Pick which libraries to back up; each one downloads as its own importable file. */
function ExportDialog({
  current,
  libs,
  load,
  onClose,
}: {
  current: CollectionKey;
  libs: string[];
  load: (key: CollectionKey) => Promise<Item[]>;
  onClose: () => void;
}) {
  const options = LIBRARIES.filter((l): l is (typeof LIBRARIES)[number] & { key: CollectionKey } =>
    (COLLECTION_KEYS as string[]).includes(l.key) && (l.key === current || libs.includes(l.key)),
  );
  const [picked, setPicked] = useState<Set<CollectionKey>>(() => new Set([current]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allPicked = picked.size === options.length;

  const toggle = (key: CollectionKey) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      // Keep the library order of the home picker.
      await downloadAll(await buildExports(options.map((o) => o.key).filter((k) => picked.has(k)), load));
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Could not export."));
      setBusy(false);
    }
  };

  return (
    <Modal label="Export backup" onClose={onClose} width={380}>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold tracking-[-.01em]">Export backup</h2>
        <button
          type="button"
          onClick={() => setPicked(allPicked ? new Set() : new Set(options.map((o) => o.key)))}
          className="cursor-pointer border-none bg-transparent p-0 text-xs text-muted2 hover:text-text"
        >
          {allPicked ? "Select none" : "Select all"}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] text-text2 hover:bg-wc">
            <input type="checkbox" checked={picked.has(o.key)} onChange={() => toggle(o.key)} className="size-4 cursor-pointer accent-(--accent)" />
            <span className="size-2 rounded-full" style={{ background: o.color }} aria-hidden />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-3 mb-0 text-xs leading-[1.6] text-pretty text-muted2">One JSON file per library, each importable from its own page.</p>
      {error && (
        <p role="alert" className="mt-2 mb-0 text-xs text-neg">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton + " px-4 py-2 text-[13px]"}>
          Cancel
        </button>
        <button type="button" onClick={run} disabled={busy || picked.size === 0} className={accentButton + " px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"}>
          {busy ? "Exporting…" : "Export"}
        </button>
      </div>
    </Modal>
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
