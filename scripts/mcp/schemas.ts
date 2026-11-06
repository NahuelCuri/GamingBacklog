// What the MCP tools need to know about each collection's add form, taken from
// config/collections so the two can't drift. Written to SCHEMAS_FILE by build-schemas.ts;
// tests/mcp.test.ts fails when that file is stale.
import { COLLECTIONS } from "@/config/collections";
import { isShared } from "@/lib/data/store";
import type { CollectionConfig, CollectionKey } from "@/lib/collection/types";

export const SCHEMAS_FILE = "supabase/functions/_shared/collections.json";

export function collectionSchema(key: CollectionKey, cfg: CollectionConfig) {
  const m = cfg.modal;
  const amount = cfg.ledgerMonth ? cfg.fields.price : undefined;
  return {
    key,
    noun: cfg.noun,
    nounPlural: cfg.nounPlural,
    shared: isShared(key),
    titleField: m.titleField,
    statusField: cfg.statusField,
    statuses: cfg.statuses.map((s) => s.value),
    defaultStatus: cfg.defaultStatus,
    dateField: m.autoDateField ?? null,
    accountField: cfg.accountField ?? null,
    numberFields: m.numberFields ?? [],
    yearFields: m.yearFields ?? [],
    required: amount ? [m.titleField, amount] : [m.titleField],
    fields: m.groups.flatMap((g) =>
      g.fields.map((f) => ({
        key: f.key,
        label: f.label,
        kind: f.kind,
        ...(f.placeholder && { placeholder: f.placeholder }),
        ...(f.options && { options: f.options }),
        ...(f.suggest && { suggest: f.suggest }),
        ...(f.min != null && { min: f.min }),
        ...(f.max != null && { max: f.max }),
        ...(g.showWhen && { showWhen: g.showWhen }),
      })),
    ),
  };
}

export const buildSchemas = () =>
  (Object.keys(COLLECTIONS) as CollectionKey[]).map((k) => collectionSchema(k, COLLECTIONS[k]));

export const schemasJson = () => JSON.stringify(buildSchemas(), null, 2) + "\n";
