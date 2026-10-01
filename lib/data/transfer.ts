// JSON export / import for a collection.
import type { CollectionConfig, Item } from "@/lib/collection/types";

/** Same name the legacy export used, plus the collection key: backlog-games-2026-09-25.json */
export const exportFileName = (key: string, now = new Date()) => `backlog-${key}-${now.toISOString().slice(0, 10)}.json`;

export const toExportJson = (items: Item[]) => JSON.stringify(items, null, 2);

export function downloadJson(fileName: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One backup file per library, in the same format as a single export so each
 * file can be imported back on its own page. Libraries load in parallel; any
 * failure rejects the whole export.
 */
export async function buildExports<K extends string>(keys: K[], load: (key: K) => Promise<Item[]>, now = new Date()) {
  const lists = await Promise.all(keys.map(load));
  return keys.map((key, i) => ({ key, fileName: exportFileName(key, now), json: toExportJson(lists[i]) }));
}

/** Downloads several files, spaced out so the browser doesn't drop any. */
export async function downloadAll(files: { fileName: string; json: string }[]) {
  for (let i = 0; i < files.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 250));
    downloadJson(files[i].fileName, files[i].json);
  }
}

/** Key-order-insensitive JSON, so a re-saved item with shuffled keys still compares equal. */
const stable = (v: unknown): string =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? "[" + v.map(stable).join(",") + "]"
      : "{" + Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k])).join(",") + "}"
    : JSON.stringify(v ?? null);

export interface ImportDiff {
  added: Item[];
  /** Same id, different content; `fields` lists the keys whose values differ. */
  changed: { before: Item; after: Item; fields: string[] }[];
  unchanged: number;
  /** Rows a replace would delete (absent from the file). A merge keeps them. */
  removed: Item[];
}

/** What importing `incoming` would do to `current`, item by item. */
export function diffImport(current: Item[], incoming: Item[]): ImportDiff {
  const byId = new Map(current.map((g) => [g.id, g]));
  const inFile = new Set(incoming.map((g) => g.id));
  const diff: ImportDiff = { added: [], changed: [], unchanged: 0, removed: current.filter((g) => !inFile.has(g.id)) };
  for (const after of incoming) {
    const before = byId.get(after.id);
    if (!before) {
      diff.added.push(after);
      continue;
    }
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => stable(before[k]) !== stable(after[k]));
    if (fields.length) diff.changed.push({ before, after, fields });
    else diff.unchanged++;
  }
  return diff;
}

export type ImportResult = { ok: true; items: Item[] } | { ok: false; error: string };

/**
 * Validate an import file before it replaces anything. It must be a JSON array
 * of objects, each with a unique non-empty string `id`. Other fields are not
 * checked, so any backup the app produced can always be restored.
 */
export function parseImport(text: string, cfg: CollectionConfig): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  if (!Array.isArray(data)) return { ok: false, error: "Expected a list of " + cfg.nounPlural + "." };
  const seen = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const where = `Row ${i + 1}`;
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, error: `${where} is not an object.` };
    const { id } = row as Record<string, unknown>;
    if (typeof id !== "string" || !id) return { ok: false, error: `${where} has no id.` };
    if (seen.has(id)) return { ok: false, error: `${where} repeats id "${id}".` };
    seen.add(id);
  }
  return { ok: true, items: data as Item[] };
}
