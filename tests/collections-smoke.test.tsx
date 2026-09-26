// @vitest-environment jsdom
// Renders every view of every collection on its seed (and every item in the
// edit form and share card) and fails on any React warning or error —
// duplicate keys, bad props, crashes on unusual data.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionContext, type CollectionCtx } from "@/components/collection/CollectionContext";
import { ItemModal, type ModalState } from "@/components/collection/ItemModal";
import { LibraryView } from "@/components/collection/LibraryView";
import { RouletteView } from "@/components/collection/RouletteView";
import { ShareCardDialog } from "@/components/collection/share/ShareCardDialog";
import { ShareImageDialog } from "@/components/collection/share/ShareImageDialog";
import { StatsView } from "@/components/collection/stats/StatsView";
import { COLLECTIONS } from "@/config/collections";
import { blankDraft, buildStats, draftFromItem, type CollectionKey, type Item } from "@/lib/collection";
import { DEFAULT_URL_STATE } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { usd } from "@/lib/spending";
import { KEYS, seed } from "./legacy";

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args.map(String).join(" ")));
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ctxFor(key: CollectionKey, items: Item[]): CollectionCtx {
  const noop = vi.fn();
  return {
    collection: key, cfg: COLLECTIONS[key], data: { ...initialCollectionState, status: "ready", items }, items,
    actions: { save: noop, remove: noop, loadStarter: noop, refresh: noop } as never,
    money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: noop,
    openAdd: noop, openEdit: noop, openShare: noop, openStatsImage: noop,
  };
}

function Modal({ initial }: { initial: ModalState }) {
  const [m, setM] = useState<ModalState | null>(initial);
  return m ? <ItemModal modal={m} setModal={setM} onClose={() => setM(null)} /> : null;
}

describe.each(KEYS)("%s", (key) => {
  const cfg = COLLECTIONS[key];
  const items = seed(key);
  const wrap = (ui: React.ReactNode) => render(<CollectionContext.Provider value={ctxFor(key, items)}>{ui}</CollectionContext.Provider>);

  it("library renders as table and cards", () => {
    wrap(<LibraryView />);
    fireEvent.click(screen.getByRole("button", { name: "Card view" }));
    expect(errors).toEqual([]);
  });

  it("stats render every widget", () => {
    wrap(<StatsView />);
    // Widgets with hideWhenEmpty may drop out; everything built must be on screen.
    const built = buildStats(cfg, items, { accent: cfg.theme.accent });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      [...built.left, ...built.right].map((w) => w.title),
    );
    expect(errors).toEqual([]);
  });

  if (cfg.roulette) {
    it("roulette renders and spins (reduced motion)", () => {
      wrap(<RouletteView />);
      fireEvent.click(screen.getByRole("button", { name: "Spin" }));
      fireEvent.click(screen.getByRole("button", { name: "Hand-pick" }));
      expect(errors).toEqual([]);
    });
  }

  it("add form renders", () => {
    wrap(<Modal initial={{ mode: "add", draft: blankDraft(cfg) }} />);
    expect(errors).toEqual([]);
  });

  it("edit form and share card render for every seed item", () => {
    for (const g of items) {
      const { unmount } = wrap(
        <>
          <Modal initial={{ mode: "edit", draft: draftFromItem(cfg, g) }} />
          <ShareCardDialog item={g} onClose={() => {}} />
        </>,
      );
      unmount();
    }
    expect(errors).toEqual([]);
  });

  it("survives messy real-world data", () => {
    const f = cfg.fields;
    const messy: Item[] = [
      ...items,
      // repeated tags, blank/whitespace/null values, numbers stored as text
      { ...items[0], id: "zz-messy-1", [cfg.tagField]: ["A", "A", "B"], [f.score]: "7", [f.hours]: "12", [f.price]: "9.99", [f.platform]: " " },
      { id: "zz-messy-2", [cfg.modal.titleField]: String(items[0][cfg.modal.titleField]), [cfg.tagField]: null, [cfg.statusField]: "unknown-status" },
      { id: "zz-messy-3", [cfg.modal.titleField]: "", [cfg.statusField]: cfg.defaultStatus, ...(cfg.categoryField ? { [cfg.categoryField]: "  Other " } : {}) },
      { id: "zz-messy-4" },
    ];
    const ctx = ctxFor(key, messy);
    const r = (ui: React.ReactNode) => render(<CollectionContext.Provider value={ctx}>{ui}</CollectionContext.Provider>);
    r(<LibraryView />);
    fireEvent.click(screen.getByRole("button", { name: "Card view" }));
    cleanup();
    r(<StatsView />);
    cleanup();
    if (cfg.roulette) {
      r(<RouletteView />);
      cleanup();
    }
    r(<ShareImageDialog onClose={() => {}} />);
    cleanup();
    for (const g of messy.slice(-4)) {
      const { unmount } = r(
        <>
          <Modal initial={{ mode: "edit", draft: draftFromItem(cfg, g) }} />
          <ShareCardDialog item={g} onClose={() => {}} />
        </>,
      );
      unmount();
    }
    expect(errors).toEqual([]);
  });

  it("stats image renders with every module", () => {
    wrap(<ShareImageDialog onClose={() => {}} />);
    for (const m of cfg.stats.shareModules) {
      const pill = screen.getByRole("button", { name: m.label });
      if (pill.getAttribute("aria-pressed") === "false") fireEvent.click(pill);
    }
    expect(errors).toEqual([]);
  });
});
