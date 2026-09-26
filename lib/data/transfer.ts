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
