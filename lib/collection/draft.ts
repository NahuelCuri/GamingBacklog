// Add/edit form logic: draft ⇄ item conversion and the modal's pure helpers
// (duplicate check, suggestions, conditional groups).
import { condMatch } from "./format";
import type { CollectionConfig, Item, ModalField, ModalGroup } from "./types";

/** Form state: item fields as edited, plus `_ti_<field>` tag-input buffers. */
export type Draft = Record<string, unknown> & { id?: string };

const modalFields = (cfg: CollectionConfig) => cfg.modal.groups.flatMap((g) => g.fields);

export function blankDraft(cfg: CollectionConfig, today = new Date()): Draft {
  const d: Draft = { tagInput: "" };
  for (const f of modalFields(cfg)) {
    if (f.kind === "tags") d[f.key] = [];
    else if (f.kind === "toggle") d[f.key] = false;
    else if (f.kind === "status") d[f.key] = cfg.defaultStatus;
    else d[f.key] = "";
  }
  if (cfg.modal.autoDateField) d[cfg.modal.autoDateField] = today.toISOString().slice(0, 10);
  return d;
}

export function draftFromItem(cfg: CollectionConfig, g: Item): Draft {
  const d: Draft = { ...g, tagInput: "" };
  for (const f of modalFields(cfg)) {
    if (f.kind === "tags") d[f.key] = [...((g[f.key] as string[]) || [])];
    else if (f.kind === "toggle") d[f.key] = !!g[f.key];
    else if (f.kind === "status") d[f.key] = g[f.key] || cfg.defaultStatus;
    else d[f.key] = g[f.key] ?? "";
  }
  return d;
}

export const newId = () => "x" + Date.now();

/** Normalize a draft into a stored item. Only modal fields are kept. */
export function itemFromDraft(cfg: CollectionConfig, d: Draft, makeId: () => string = newId): Item {
  const m = cfg.modal;
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const out: Item = { id: d.id || makeId() };
  for (const f of modalFields(cfg)) {
    const k = f.key, v = d[k];
    if (f.kind === "tags") out[k] = [...((v as string[]) || [])];
    else if (f.kind === "toggle") out[k] = !!v;
    else if (m.numberFields?.includes(k)) out[k] = numOrNull(v);
    else if (m.yearFields?.includes(k)) out[k] = v === "" || v == null ? null : String(v);
    else if (k === m.titleField) out[k] = String(v || "").trim();
    else out[k] = typeof v === "string" ? v.trim() : v;
  }
  if (cfg.accountField && out[cfg.statusField] !== "transfer") out[cfg.accountField] = "";
  return out;
}

export function isDraftValid(cfg: CollectionConfig, d: Draft): boolean {
  const t = d[cfg.modal.titleField];
  return typeof t === "string" && t.trim() !== "";
}

/** Another item with the same title (case/space-insensitive), for `dupCheck` fields. */
export function findDuplicate(cfg: CollectionConfig, items: Item[], d: Draft): Item | null {
  const key = cfg.modal.titleField;
  const dt = String(d[key] || "").trim().toLowerCase();
  if (!dt) return null;
  return items.find((g) => g.id !== d.id && String(g[key] || "").trim().toLowerCase() === dt) ?? null;
}

export function groupVisible(group: ModalGroup, d: Draft): boolean {
  return !group.showWhen || condMatch(group.showWhen, d);
}

/**
 * Keys to blank when `field` changes to `value`: the fields of every conditional
 * group on that field that the new value hides.
 */
export function fieldsHiddenBy(cfg: CollectionConfig, d: Draft, field: string, value: unknown): string[] {
  const next = { ...d, [field]: value };
  return cfg.modal.groups
    .filter((gr) => gr.showWhen && gr.showWhen.field === field && !condMatch(gr.showWhen, next))
    .flatMap((gr) => gr.fields.map((f) => f.key));
}

/** Clicking the selected enum chip clears it. */
export const enumNext = (current: unknown, clicked: string) => (current === clicked ? "" : clicked);

export const tagInputKey = (field: string) => "_ti_" + field;

/** Add a tag to a draft field; no-op for blanks and duplicates. Clears the input buffer. */
export function withTag(d: Draft, field: string, raw: unknown): Draft {
  const t = String(raw || "").trim();
  const cur = (d[field] as string[]) || [];
  if (!t || cur.includes(t)) return d;
  return { ...d, [field]: [...cur, t], [tagInputKey(field)]: "" };
}

export function withoutTag(d: Draft, field: string, t: string): Draft {
  return { ...d, [field]: ((d[field] as string[]) || []).filter((x) => x !== t) };
}

/** Up to 8 existing tag values not on the draft, filtered by the typed text, most used first. */
export function tagSuggestions(items: Item[], field: string, d: Draft): string[] {
  const typed = String(d[tagInputKey(field)] || "").toLowerCase();
  const have = (d[field] as string[]) || [];
  const counts: Record<string, number> = {};
  items.forEach((g) => ((g[field] as string[]) || []).forEach((v) => (counts[v] = (counts[v] || 0) + 1)));
  return Object.keys(counts)
    .filter((t) => !have.includes(t) && (!typed || t.toLowerCase().includes(typed)))
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 8);
}

/** Free-text combo suggestions: values used before (plus config seeds), most used first. */
export function comboSuggestions(items: Item[], f: ModalField, current: unknown): string[] {
  const counts: Record<string, number> = {};
  items.forEach((g) => {
    const v = (g[f.key] == null ? "" : String(g[f.key])).trim();
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  (f.suggest || []).forEach((s) => {
    if (!(s in counts)) counts[s] = 0;
  });
  const typed = String(current ?? "").trim().toLowerCase();
  return Object.keys(counts)
    .filter((v) => v.toLowerCase() !== typed && (!typed || v.toLowerCase().includes(typed)))
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .slice(0, 12);
}
