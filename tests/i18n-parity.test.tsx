// @vitest-environment jsdom
// Spanish on the real views: our translator and the legacy i18n.js script must
// turn the same rendered English DOM into the same Spanish DOM.
import fs from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionContext, type CollectionCtx } from "@/components/collection/CollectionContext";
import { ItemModal } from "@/components/collection/ItemModal";
import { LibraryView } from "@/components/collection/LibraryView";
import { MonthsView } from "@/components/collection/MonthsView";
import { RouletteView } from "@/components/collection/RouletteView";
import { ShareImageDialog } from "@/components/collection/share/ShareImageDialog";
import { StatsView } from "@/components/collection/stats/StatsView";
import { COLLECTIONS } from "@/config/collections";
import { blankDraft, type CollectionKey, type Item } from "@/lib/collection";
import { DEFAULT_URL_STATE } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { createTranslator } from "@/lib/i18n/translator";
import { usd } from "@/lib/spending";
import { seed } from "./legacy";

const LEGACY = fs.readFileSync(path.join(__dirname, "../legacy-src/i18n.js"), "utf8");

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  localStorage.setItem("bl_lang", "es");
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  localStorage.clear();
});

function ctxFor(key: CollectionKey, items: Item[]): CollectionCtx {
  const noop = vi.fn();
  return {
    collection: key, cfg: COLLECTIONS[key], data: { ...initialCollectionState, status: "ready", items }, items,
    actions: { save: noop, remove: noop } as never, money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: noop,
    openAdd: noop, openEdit: noop, openShare: noop, openStatsImage: noop,
  };
}

/** Spanish HTML from both implementations for the same rendered view. */
function bothWays(key: CollectionKey, ui: React.ReactNode) {
  const { container } = render(<CollectionContext.Provider value={ctxFor(key, seed(key))}>{ui}</CollectionContext.Provider>);
  const english = document.body.innerHTML;
  // cloneNode keeps text-node boundaries (innerHTML would merge adjacent ones);
  // legacy's runtime also split interpolations into their own nodes.
  const copy = document.body.cloneNode(true) as HTMLElement;

  // Ours: on the live React tree.
  const t = createTranslator(document.body);
  t.setLang("es");
  const ours = container.ownerDocument.body.innerHTML;
  t.stop();

  // Legacy: a static copy of the English DOM. The port marks brands with
  // translate="no" where legacy used data-no-i18n.
  document.body.replaceChildren(...copy.childNodes);
  document.querySelectorAll("[translate='no']").forEach((el) => el.setAttribute("data-no-i18n", ""));
  new Function(LEGACY)();
  document.getElementById("bl-lang")?.remove();
  document.querySelectorAll("[data-no-i18n='']").forEach((el) => el.hasAttribute("translate") && el.removeAttribute("data-no-i18n"));
  return { english, ours, legacy: document.body.innerHTML };
}

/** Every translatable string in document order: text nodes and placeholder/title. */
function surface(html: string): string[] {
  const root = document.createElement("div");
  root.innerHTML = html;
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE && n.nodeValue!.trim()) out.push(n.nodeValue!.trim());
    if (n.nodeType === Node.ELEMENT_NODE)
      for (const a of ["placeholder", "title"]) if ((n as Element).hasAttribute(a)) out.push(`@${a}=${(n as Element).getAttribute(a)}`);
    n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
}

const KEYS = Object.keys(COLLECTIONS) as CollectionKey[];

describe.each(KEYS)("%s in Spanish", (key) => {
  const cfg = COLLECTIONS[key];
  const views: [string, React.ReactNode][] = [
    ["library", <LibraryView key="l" />],
    ["stats", <StatsView key="s" />],
    ["add form", <ItemModal key="m" modal={{ mode: "add", draft: blankDraft(cfg) }} setModal={() => {}} onClose={() => {}} />],
    ["stats image", <ShareImageDialog key="i" onClose={() => {}} />],
  ];
  if (cfg.roulette) views.push(["roulette", <RouletteView key="r" />]);
  if (cfg.months) views.push(["months", <MonthsView key="mo" />]);

  it.each(views)("%s matches legacy", (_name, ui) => {
    const { english, ours, legacy } = bothWays(key, ui);
    expect(surface(ours)).toEqual(surface(legacy)); // readable diff first
    expect(ours).toBe(legacy);
    if (key === "books" || key === "expenses") expect(ours).not.toBe(english);
  });
});
