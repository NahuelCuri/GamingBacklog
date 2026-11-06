// The Backlog MCP: tools and JSON-RPC handling, shared by the Supabase Edge Function
// (supabase/functions/mcp, Deno) and the local stdio server (scripts/mcp/server.mjs, Node).
// Plain TypeScript with no runtime imports besides collections.json, so both can load it;
// storage comes in as a `Rows`, already scoped to the signed-in user.
import collections from "./collections.json" with { type: "json" };

export type Item = Record<string, unknown> & { id: string };

export interface CollectionSchema {
  key: string;
  noun: string;
  nounPlural: string;
  shared: boolean;
  titleField: string;
  statusField: string;
  statuses: string[];
  defaultStatus: string;
  dateField: string | null;
  accountField: string | null;
  numberFields: string[];
  yearFields: string[];
  required: string[];
  fields: {
    key: string;
    label: string;
    kind: string;
    placeholder?: string;
    options?: string[];
    suggest?: string[];
    min?: number;
    max?: number;
    showWhen?: { field: string; eq?: unknown };
  }[];
}

export const COLLECTIONS = collections as CollectionSchema[];

const schemaOf = (key: unknown): CollectionSchema => {
  const s = COLLECTIONS.find((c) => c.key === key);
  if (!s) throw new Error(`Unknown collection "${key}". One of: ${COLLECTIONS.map((c) => c.key).join(", ")}`);
  return s;
};

// ---------------------------------------------------------------- storage

/** Rows of one user. `from`/`to` are inclusive "YYYY-MM-DD" bounds on `field`. */
export interface Rows {
  list(collection: string, range?: { field: string; from?: string; to?: string }): Promise<Item[]>;
  get(collection: string, id: string): Promise<Item | null>;
  put(collection: string, items: Item[]): Promise<void>;
  remove(collection: string, ids: string[]): Promise<void>;
}

/** The slice of a supabase-js client this needs (typed loosely so Node and Deno builds both fit). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from(table: string): any };

/** Same tables and row shape as lib/data/store.ts; RLS on the caller's token does the scoping. */
export function supabaseRows(sb: Sb, uid: string): Rows {
  const unwrap = ({ data, error }: { data: { data: Item | null }[] | null; error: unknown }) => {
    if (error) throw error;
    return (data ?? []).map((r) => r.data).filter((x): x is Item => !!x);
  };
  const check = ({ error }: { error: unknown }) => {
    if (error) throw error;
  };
  const shared = (c: string) => schemaOf(c).shared;
  return {
    async list(c, range) {
      let q = sb.from(c).select("data");
      if (range?.from) q = q.gte(`data->>${range.field}`, range.from);
      if (range?.to) q = q.lte(`data->>${range.field}`, range.to);
      return unwrap(await q);
    },
    async get(c, id) {
      let q = sb.from(c).select("data").eq("id", id);
      if (!shared(c)) q = q.eq("user_id", uid);
      return unwrap(await q)[0] ?? null;
    },
    async put(c, items) {
      if (!items.length) return;
      if (shared(c)) {
        const at = new Date().toISOString();
        check(await sb.from(c).upsert(items.map((g) => ({ id: g.id, data: g, added_by: uid, updated_at: at })), { onConflict: "id" }));
      } else {
        check(await sb.from(c).upsert(items.map((g) => ({ user_id: uid, id: g.id, data: g })), { onConflict: "user_id,id" }));
      }
    },
    async remove(c, ids) {
      if (!ids.length) return;
      let q = sb.from(c).delete().in("id", ids);
      if (!shared(c)) q = q.eq("user_id", uid);
      check(await q);
    },
  };
}

/** In-memory rows for tests. */
export function memoryRows(initial: Record<string, Item[]> = {}): Rows & { data: Record<string, Map<string, Item>> } {
  const data: Record<string, Map<string, Item>> = {};
  const t = (c: string) => (data[c] ??= new Map());
  for (const [c, items] of Object.entries(initial)) items.forEach((g) => t(c).set(g.id, g));
  return {
    data,
    async list(c, range) {
      return [...t(c).values()].filter((g) => {
        if (!range) return true;
        const v = String(g[range.field] ?? "");
        return (!range.from || v >= range.from) && (!range.to || v <= range.to);
      });
    },
    async get(c, id) {
      return t(c).get(id) ?? null;
    },
    async put(c, items) {
      items.forEach((g) => t(c).set(g.id, g));
    },
    async remove(c, ids) {
      ids.forEach((id) => t(c).delete(id));
    },
  };
}

// ---------------------------------------------------------------- items

export interface Ctx {
  rows: Rows;
  user: { id: string; email?: string | null };
  /** IANA zone "today" is taken in, for default dates. */
  tz: string;
  now?: () => Date;
}

/** "YYYY-MM-DD" of `d` in `tz`. */
export const dayIn = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A blank item as the add form starts it (lib/collection/draft.ts blankDraft). */
function blank(s: CollectionSchema, today: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const f of s.fields) {
    if (f.kind === "tags") d[f.key] = [];
    else if (f.kind === "toggle") d[f.key] = false;
    else if (f.kind === "status") d[f.key] = s.defaultStatus;
    else if (s.numberFields.includes(f.key) || s.yearFields.includes(f.key)) d[f.key] = null;
    else d[f.key] = "";
  }
  if (s.dateField) d[s.dateField] = today;
  return d;
}

function checkKeys(s: CollectionSchema, patch: Record<string, unknown>) {
  const known = new Set(s.fields.map((f) => f.key));
  const bad = Object.keys(patch).filter((k) => k !== "id" && !known.has(k));
  if (bad.length) throw new Error(`Unknown field(s) ${bad.join(", ")} for ${s.key}. Fields: ${[...known].join(", ")}`);
}

/** Coerces and checks fields the way the add form stores them (itemFromDraft), or throws a readable error. */
export function normalize(s: CollectionSchema, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const f of s.fields) {
    const k = f.key, v = input[k];
    const where = `${s.noun} "${input[s.titleField] ?? ""}": ${k}`;
    if (f.kind === "tags") {
      const list = v == null || v === "" ? [] : Array.isArray(v) ? v : String(v).split(",");
      out[k] = list.map((x) => String(x).trim()).filter(Boolean);
    } else if (f.kind === "toggle") out[k] = v === true || v === "true";
    else if (s.numberFields.includes(k)) {
      if (v === "" || v == null) out[k] = null;
      else {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${where} must be a number (got ${JSON.stringify(v)})`);
        if (f.min != null && n < f.min) throw new Error(`${where} must be ≥ ${f.min}`);
        if (f.max != null && n > f.max) throw new Error(`${where} must be ≤ ${f.max}`);
        out[k] = n;
      }
    } else if (s.yearFields.includes(k)) out[k] = v === "" || v == null ? null : String(v);
    else {
      const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
      if (f.kind === "status" && !s.statuses.includes(t)) throw new Error(`${where} must be one of ${s.statuses.join(", ")}`);
      if (f.kind === "enum" && t && f.options && !f.options.includes(t)) throw new Error(`${where} must be one of ${f.options.join(", ")} (or empty)`);
      if (f.kind === "date" && t && !DAY.test(t)) throw new Error(`${where} must be YYYY-MM-DD (got ${JSON.stringify(v)})`);
      out[k] = t;
    }
  }
  for (const k of s.required) {
    if (out[k] === "" || out[k] == null) throw new Error(`${s.noun} needs ${k}`);
  }
  if (s.accountField && out[s.statusField] !== "transfer") out[s.accountField] = "";
  return out;
}

// ---------------------------------------------------------------- tools

type JsonSchema = Record<string, unknown>;

function fieldSchema(s: CollectionSchema, f: CollectionSchema["fields"][number]): JsonSchema {
  const hint = [f.label, f.placeholder && `e.g. ${f.placeholder.replace(/^e\.g\.\s*/i, "")}`].filter(Boolean).join(" — ");
  const when = f.showWhen ? ` Only when ${f.showWhen.field} is ${JSON.stringify(f.showWhen.eq)}.` : "";
  const description = hint + when;
  if (f.kind === "tags") return { type: "array", items: { type: "string" }, description };
  if (f.kind === "toggle") return { type: "boolean", description };
  if (s.numberFields.includes(f.key)) return { type: "number", description, ...(f.min != null && { minimum: f.min }), ...(f.max != null && { maximum: f.max }) };
  if (f.kind === "status") return { type: "string", enum: s.statuses, description: `${description} (default ${s.defaultStatus})` };
  if (f.kind === "enum" && f.options) return { type: "string", enum: f.options, description };
  if (f.kind === "date")
    return { type: "string", pattern: DAY.source, description: `${description} (YYYY-MM-DD${f.key === s.dateField ? ", default today" : ""})` };
  if (f.kind === "combo" && f.suggest) return { type: "string", description: `${description}. Usual: ${f.suggest.join(", ")}; reuse the user's existing ones (list_items).` };
  return { type: "string", description };
}

const itemSchema = (s: CollectionSchema): JsonSchema => ({
  type: "object",
  properties: Object.fromEntries(s.fields.map((f) => [f.key, fieldSchema(s, f)])),
  required: s.required,
  additionalProperties: false,
});

interface Tool {
  description: string;
  inputSchema: JsonSchema;
  annotations?: Record<string, boolean | string>;
  run(args: Record<string, unknown>, ctx: Ctx): Promise<unknown>;
}

let lastId = 0;
/** "x" + epoch ms like the page's ids, never repeating within a process. */
const newId = (now: number) => "x" + (lastId = Math.max(now, lastId + 1));

const collectionArg = { type: "string", enum: COLLECTIONS.map((c) => c.key) };

export const TOOLS: Record<string, Tool> = {
  whoami: {
    description: "Which Backlog account this is connected to.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_a, ctx) {
      return ctx.user;
    },
  },
  list_items: {
    description:
      "List or search items of a collection, newest first. Dated collections (expenses, books, movies) take `month` or `from`/`to`. " +
      "Use it before adding to avoid duplicates and to reuse existing categories.",
    inputSchema: {
      type: "object",
      properties: {
        collection: collectionArg,
        month: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "YYYY-MM (dated collections)" },
        from: { type: "string", pattern: DAY.source, description: "YYYY-MM-DD, inclusive" },
        to: { type: "string", pattern: DAY.source, description: "YYYY-MM-DD, inclusive" },
        query: { type: "string", description: "Case-insensitive text matched against every text field" },
        status: { type: "string", description: "Only this status (e.g. playing, reading, expense)" },
        limit: { type: "number", minimum: 1, maximum: 500, description: "Default 100" },
      },
      required: ["collection"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const s = schemaOf(a.collection);
      let from = a.from as string | undefined, to = a.to as string | undefined;
      if (a.month) {
        from = `${a.month}-01`;
        to = `${a.month}-31`; // dates compare as text, so day 31 closes any month
      }
      if ((from || to) && !s.dateField) throw new Error(`${s.key} has no date to filter on`);
      let items = await ctx.rows.list(s.key, from || to ? { field: s.dateField!, from, to } : undefined);
      if (a.status) items = items.filter((g) => g[s.statusField] === a.status);
      if (a.query) {
        const q = String(a.query).toLowerCase();
        items = items.filter((g) => Object.values(g).some((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? "")).toLowerCase().includes(q)));
      }
      const key = s.dateField;
      items.sort((x, y) => (key ? String(y[key] ?? "").localeCompare(String(x[key] ?? "")) : 0) || y.id.localeCompare(x.id));
      const limit = Number(a.limit) || 100;
      return { total: items.length, items: items.slice(0, limit) };
    },
  },
  ...Object.fromEntries(
    COLLECTIONS.map((s): [string, Tool] => [
      `add_${s.key}`,
      {
        description:
          `Add ${s.nounPlural} to the ${s.key} library (one or several at once).` +
          (s.dateField ? ` ${s.dateField} defaults to today.` : "") +
          (s.key === "expenses" ? " amount is always positive; type says which way the money went." : ""),
        inputSchema: {
          type: "object",
          properties: { items: { type: "array", minItems: 1, items: itemSchema(s) } },
          required: ["items"],
          additionalProperties: false,
        },
        async run(a, ctx) {
          const list = a.items;
          if (!Array.isArray(list) || !list.length) throw new Error("items must be a non-empty array");
          const now = (ctx.now ?? (() => new Date()))();
          const today = dayIn(now, ctx.tz);
          const items = list.map((raw: Record<string, unknown>) => {
            checkKeys(s, raw);
            return { ...normalize(s, { ...blank(s, today), ...raw }), id: newId(now.getTime()) } as Item;
          });
          await ctx.rows.put(s.key, items);
          return { added: items };
        },
      },
    ]),
  ),
  update_item: {
    description: "Change some fields of one item; `patch` holds only the fields to change.",
    inputSchema: {
      type: "object",
      properties: { collection: collectionArg, id: { type: "string" }, patch: { type: "object" } },
      required: ["collection", "id", "patch"],
      additionalProperties: false,
    },
    async run(a, ctx) {
      const s = schemaOf(a.collection);
      const patch = (a.patch ?? {}) as Record<string, unknown>;
      checkKeys(s, patch);
      const cur = await ctx.rows.get(s.key, String(a.id));
      if (!cur) throw new Error(`No ${s.noun} with id ${a.id} in ${s.key}`);
      const next = { ...normalize(s, { ...cur, ...patch }), id: cur.id } as Item;
      await ctx.rows.put(s.key, [next]);
      return { updated: next };
    },
  },
  delete_items: {
    description: "Permanently delete items by id. Always ask the user to confirm first, then pass confirm: true.",
    inputSchema: {
      type: "object",
      properties: { collection: collectionArg, ids: { type: "array", items: { type: "string" }, minItems: 1 }, confirm: { type: "boolean" } },
      required: ["collection", "ids", "confirm"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
    async run(a, ctx) {
      const s = schemaOf(a.collection);
      if (a.confirm !== true) throw new Error("Not deleted: ask the user to confirm, then call again with confirm: true");
      const ids = (a.ids as unknown[]).map(String);
      await ctx.rows.remove(s.key, ids);
      return { deleted: ids };
    },
  },
};

// ---------------------------------------------------------------- JSON-RPC

export const SERVER_INFO = { name: "backlog", version: "0.2.0" };

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type RpcReply = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const errorText = (e: unknown) =>
  e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : String(e);

/** Answers one JSON-RPC message; null for notifications. */
export async function handleRpc(msg: Rpc, ctx: Ctx): Promise<RpcReply | null> {
  const id = msg.id ?? null;
  const reply = (r: Partial<RpcReply>): RpcReply | null => (msg.id === undefined ? null : { jsonrpc: "2.0", id, ...r });
  switch (msg.method) {
    case "initialize":
      return reply({
        result: {
          protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions:
            "The user's personal Backlog: games, books, movies, wines and expenses. " +
            "Amounts are in the user's currency (ARS). Dates are YYYY-MM-DD in the user's time zone. " +
            "Check list_items before adding when a duplicate is plausible.",
        },
      });
    case "ping":
      return reply({ result: {} });
    case "tools/list":
      return reply({
        result: {
          tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema, ...(t.annotations && { annotations: t.annotations }) })),
        },
      });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS[name];
      if (!tool) return reply({ error: { code: -32602, message: `Unknown tool ${name}` } });
      try {
        const out = await tool.run((msg.params?.arguments ?? {}) as Record<string, unknown>, ctx);
        return reply({ result: { content: [{ type: "text", text: JSON.stringify(out) }] } });
      } catch (e) {
        return reply({ result: { isError: true, content: [{ type: "text", text: errorText(e) }] } });
      }
    }
    default:
      return reply({ error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}
