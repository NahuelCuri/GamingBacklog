// EN/ES display translation, ported from legacy-src/i18n.js.
//
// Legacy translates the rendered DOM instead of threading a `lang` prop through
// every component: text nodes (and placeholder/title attributes) whose trimmed
// text exactly matches a dictionary key are swapped in place, and a
// MutationObserver re-applies after React re-renders. Kept that way for parity.
// Differences from legacy:
//  - Changes are applied inside the observer callback (before paint), so there
//    is no flash of English after a re-render.
//  - Switching back to EN restores the recorded original of each node instead
//    of reverse-mapping Spanish text, so short or ambiguous strings round-trip.
import { ES } from "./es";

export type Lang = "en" | "es";

/** Legacy key and shape ("en" | "es"), shared with the old app. */
export const LANG_KEY = "bl_lang";

const ATTRS = ["placeholder", "title"];
/** Never translated: brand names and code. */
const SKIP = "[data-no-i18n], [translate='no'], script, style";
/** Text inside these is the user's own (a textarea's initial value). */
const SKIP_TEXT = SKIP + ", textarea";

export function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

/** Spanish for a node's text, or null. Surrounding whitespace is kept. */
export function translate(raw: string, dict: Readonly<Record<string, string>> = ES): string | null {
  const k = raw.trim();
  if (!k) return null;
  const v = dict[k];
  if (v === undefined || v === k) return null;
  return raw.split(k).join(v);
}

interface Swap {
  en: string;
  es: string;
}

export interface Translator {
  readonly lang: Lang;
  setLang(lang: Lang): void;
  stop(): void;
}

export function createTranslator(root: HTMLElement, dict: Readonly<Record<string, string>> = ES): Translator {
  let lang: Lang = "en";
  const texts = new WeakMap<Text, Swap>();
  const attrs = new WeakMap<Element, Map<string, Swap>>();
  const skipped = (el: Element | null, sel = SKIP) => !el || !!el.closest(sel);

  function swapText(t: Text) {
    if (skipped(t.parentElement, SKIP_TEXT)) return;
    const cur = t.nodeValue ?? "";
    if (lang === "es") {
      const es = translate(cur, dict);
      if (es === null) return;
      texts.set(t, { en: cur, es });
      t.nodeValue = es;
    } else {
      const rec = texts.get(t);
      if (!rec) return;
      texts.delete(t);
      if (cur === rec.es) t.nodeValue = rec.en;
    }
  }

  function swapAttr(el: Element, name: string) {
    if (skipped(el)) return;
    const cur = el.getAttribute(name);
    if (cur === null) return;
    if (lang === "es") {
      const es = translate(cur, dict);
      if (es === null) return;
      let m = attrs.get(el);
      if (!m) attrs.set(el, (m = new Map()));
      m.set(name, { en: cur, es });
      el.setAttribute(name, es);
    } else {
      const rec = attrs.get(el)?.get(name);
      if (!rec) return;
      attrs.get(el)!.delete(name);
      if (cur === rec.es) el.setAttribute(name, rec.en);
    }
  }

  function sweep(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return swapText(node as Text);
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const found: Text[] = [];
    while (walker.nextNode()) found.push(walker.currentNode as Text);
    found.forEach(swapText);
    const sel = ATTRS.map((a) => `[${a}]`).join(",");
    [el, ...el.querySelectorAll(sel)].forEach((x) => ATTRS.forEach((a) => x.hasAttribute(a) && swapAttr(x, a)));
  }

  const observer = new MutationObserver((records) => {
    if (lang !== "es") return;
    for (const r of records) {
      if (r.type === "characterData") swapText(r.target as Text);
      else if (r.type === "attributes") swapAttr(r.target as Element, r.attributeName!);
      else r.addedNodes.forEach(sweep);
    }
    observer.takeRecords(); // drop the records our own writes just queued
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  return {
    get lang() {
      return lang;
    },
    setLang(next) {
      lang = next;
      sweep(root);
      observer.takeRecords();
      document.documentElement.lang = next;
    },
    stop() {
      observer.disconnect();
    },
  };
}
