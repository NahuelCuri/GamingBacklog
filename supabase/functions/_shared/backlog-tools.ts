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

/** Trip Planner tables (lib/trips/store.ts): shared rows, RLS limits them to the user's own and shared trips. */
const TRIP_TABLES = ["trips", "trip_cards"];

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
  const shared = (c: string) => TRIP_TABLES.includes(c) || schemaOf(c).shared;
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

/** Where the form's label leaves the meaning or unit open, what a model needs to fill the field right. */
export const FIELD_HINTS: Record<string, string> = {
  "games.score": "My score, 0–10 (decimals allowed)",
  "games.hours": "Hours I've played it",
  "games.hltb": "HowLongToBeat main-story estimate, in hours",
  "games.yearCompleted": "Year I finished it, e.g. 2026 (status played)",
  "games.source": "How I got it (Game Pass = played through the subscription)",
  "games.price": "What I paid, in US dollars (0 when free)",
  "games.purchaseDate": "When I bought or got it",
  "games.owned": "I own a copy (not just played it somewhere)",
  "games.releaseDate": "The game's release date",
  "books.score": "My rating, 0–10",
  "books.volume": "Number within the series",
  "books.pubYear": "Year first published",
  "books.language": "Language I read it in, e.g. English",
  "books.dateAdded": "When it went on my list",
  "movies.rating": "My rating, 0–10",
  "movies.imdb": "IMDb rating, 0–10",
  "movies.rt": "Rotten Tomatoes critics score, in percent (0–100)",
  "movies.runtime": "Runtime in minutes (movies)",
  "movies.epLength": "Average episode length in minutes (series)",
  "movies.episodes": "Total episodes (series)",
  "movies.seasons": "Number of seasons (series)",
  "movies.year": "Release year (first season for series)",
  "movies.finished": "When I finished watching it",
  "movies.dateAdded": "When it went on my list",
  "wines.vintage": "Vintage (harvest year)",
  "wines.storage": "Where the bottle is kept at home",
  "wines.grape": "Grape varieties, one per entry for a blend",
  "expenses.title": "What it was, e.g. Steam, McDonald's, Salary",
  "expenses.amount": "Amount in Argentine pesos (ARS), always positive",
  "expenses.type": "expense = money out, income = money in, transfer = moved to one of my accounts",
  "expenses.account": "Account the money moved to",
};

function fieldSchema(s: CollectionSchema, f: CollectionSchema["fields"][number]): JsonSchema {
  const hint = FIELD_HINTS[`${s.key}.${f.key}`] ?? [f.label, f.placeholder && `e.g. ${f.placeholder.replace(/^e\.g\.\s*/i, "")}`].filter(Boolean).join(" — ");
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

// ---------------------------------------------------------------- summaries, suggestions, trips

const MONTH = /^\d{4}-\d{2}$/;
const monthArg = { type: "string", pattern: MONTH.source, description: "YYYY-MM" };
const money = (n: number) => Math.round(n * 100) / 100;
const todayOf = (ctx: Ctx) => dayIn((ctx.now ?? (() => new Date()))(), ctx.tz);

/** "2026-10", -1 → "2026-09". */
export function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
}

const monthItems = (ctx: Ctx, m: string) => ctx.rows.list("expenses", { field: "date", from: `${m}-01`, to: `${m}-31` });
const shiftDay = (d: string, by: number) => new Date(Date.parse(d + "T00:00:00Z") + by * 86400000).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000;

/** Lowercase, no accents or punctuation, so names compare loosely ("Día" = "dia"). */
const loose = (t: unknown) =>
  String(t ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function totals(items: Item[], groupBy: string) {
  const sum: Record<string, number> = { income: 0, expense: 0, transfer: 0 };
  const groups = new Map<string, { total: number; count: number }>();
  for (const g of items) {
    const amt = Number(g.amount) || 0;
    const type = String(g.type || "expense");
    sum[type] = (sum[type] ?? 0) + amt;
    if (type !== "expense") continue;
    const key = String(g[groupBy] || "(none)");
    const cur = groups.get(key) ?? { total: 0, count: 0 };
    cur.total += amt;
    cur.count++;
    groups.set(key, cur);
  }
  return { income: money(sum.income), expense: money(sum.expense), transfer: money(sum.transfer), net: money(sum.income - sum.expense), count: items.length, groups };
}

/** Per library: the "done" status and its year, the score, length and tag fields. */
const STATS: Record<string, { done: string; doneYear: (g: Item) => string; score?: string; length?: { field: string; unit: string }; tags: string }> = {
  games: { done: "played", doneYear: (g) => String(g.yearCompleted ?? ""), score: "score", length: { field: "hltb", unit: "hours to beat" }, tags: "tags" },
  books: { done: "finished", doneYear: (g) => String(g.finished ?? "").slice(0, 4), score: "score", length: { field: "pages", unit: "pages" }, tags: "genres" },
  movies: { done: "completed", doneYear: (g) => String(g.finished ?? "").slice(0, 4), score: "rating", length: { field: "runtime", unit: "minutes" }, tags: "genres" },
  wines: { done: "opened", doneYear: () => "", tags: "grape" },
};

// Trip cards as lib/trips/model.ts defines them (tests/mcp.test.ts keeps these in sync).
export const TRIP_CARD_TYPES = ["place", "food", "activity", "lodging", "transport", "watch", "research", "todo", "important"];
export const TRIP_CARD_STATUSES = ["idea", "researched", "confirmed", "booked"];
export const TRIP_CARD_PRIOS = ["must", "nice", "backup"];
/** Like the planner's newId: time first, then a random tail (every account writes to the same table). */
const cardId = (now: number) => "c" + now + crypto.randomUUID().slice(0, 6);

const cardProps: Record<string, JsonSchema> = {
  title: { type: "string" },
  type: { type: "string", enum: TRIP_CARD_TYPES, description: "default place" },
  status: { type: "string", enum: TRIP_CARD_STATUSES, description: "default idea" },
  priority: { type: "string", enum: TRIP_CARD_PRIOS, description: "default nice" },
  tags: { type: "array", items: { type: "string" } },
  price: { type: "number", description: "In the trip's currency" },
  region: { type: "string", description: "Neighbourhood or city" },
  notes: { type: "string" },
  source: { type: "string", description: "Link" },
  startTime: { type: "string", description: "e.g. 09:30" },
  duration: { type: "string", description: "e.g. 2h" },
  day: { type: ["number", "null"], minimum: 1, description: "Day of the trip (1 = first); null keeps it in the pool" },
};

/** Checks a card the way the planner's editor stores it (cleanCard). */
function checkCardKeys(input: Record<string, unknown>) {
  const bad = Object.keys(input).filter((k) => !(k in cardProps));
  if (bad.length) throw new Error(`Unknown card field(s) ${bad.join(", ")}. Fields: ${Object.keys(cardProps).join(", ")}`);
}

function cleanCard(input: Record<string, unknown>): Item {
  const out: Record<string, unknown> = { ...input, title: String(input.title ?? "").trim() };
  if (!out.title) throw new Error("A card needs a title");
  const oneOf = (k: string, list: string[]) => {
    if (!list.includes(String(out[k]))) throw new Error(`card "${out.title}": ${k} must be one of ${list.join(", ")}`);
  };
  oneOf("type", TRIP_CARD_TYPES);
  oneOf("status", TRIP_CARD_STATUSES);
  oneOf("priority", TRIP_CARD_PRIOS);
  out.tags = (Array.isArray(out.tags) ? out.tags : String(out.tags ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean);
  if (out.price === "" || out.price == null) out.price = null;
  else if (!Number.isFinite(Number(out.price))) throw new Error(`card "${out.title}": price must be a number`);
  else out.price = Number(out.price);
  if (out.day === "" || out.day == null) out.day = null;
  else if (!Number.isInteger(Number(out.day)) || Number(out.day) < 1) throw new Error(`card "${out.title}": day must be 1 or more`);
  else out.day = Number(out.day);
  return out as Item;
}

async function tripOf(ctx: Ctx, id: unknown) {
  const t = await ctx.rows.get("trips", String(id));
  if (!t) throw new Error(`No trip with id ${id} (list_trips shows them)`);
  return t;
}

const EXTRA_TOOLS: Record<string, Tool> = {
  summarize_expenses: {
    description:
      "Totals of the expenses ledger for a month (default this month) or a from/to range: income, expense, net, and expenses " +
      "grouped by category (or account / title). For a month it also gives the previous month's totals per group.",
    inputSchema: {
      type: "object",
      properties: {
        month: monthArg,
        from: { type: "string", pattern: DAY.source, description: "YYYY-MM-DD, instead of month" },
        to: { type: "string", pattern: DAY.source, description: "YYYY-MM-DD, instead of month" },
        group_by: { type: "string", enum: ["category", "account", "title"], description: "default category" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const groupBy = String(a.group_by || "category");
      const ranged = !a.month && !!(a.from || a.to);
      const month = String(a.month || todayOf(ctx).slice(0, 7));
      const items = ranged
        ? await ctx.rows.list("expenses", { field: "date", from: a.from as string | undefined, to: a.to as string | undefined })
        : await monthItems(ctx, month);
      const cur = totals(items, groupBy);
      const prevMonth = ranged ? null : shiftMonth(month, -1);
      const prev = prevMonth ? totals(await monthItems(ctx, prevMonth), groupBy) : null;
      const keys = [...cur.groups.keys(), ...(prev ? [...prev.groups.keys()].filter((k) => !cur.groups.has(k)) : [])];
      const expensesBy = keys
        .map((k) => ({
          [groupBy]: k,
          total: money(cur.groups.get(k)?.total ?? 0),
          count: cur.groups.get(k)?.count ?? 0,
          ...(prev && { previous: money(prev.groups.get(k)?.total ?? 0) }),
        }))
        .sort((x, y) => y.total - x.total || (y.previous ?? 0) - (x.previous ?? 0));
      const { groups: _g, ...head } = cur;
      return {
        ...(ranged ? { from: a.from ?? null, to: a.to ?? null } : { month }),
        ...head,
        ...(prev && { previous: { month: prevMonth, income: prev.income, expense: prev.expense, net: prev.net } }),
        expensesBy,
      };
    },
  },
  reconcile_statement: {
    description:
      "Compare the movements of a bank or card statement with the expenses ledger. A movement counts as recorded when an entry of the " +
      "same type and amount is within `tolerance_days` (names may differ). Returns the matches, the missing movements (in the statement, " +
      "not in the app) and the app-only entries of the period. Adds nothing: show the missing ones and add them with add_expenses if the user agrees.",
    inputSchema: {
      type: "object",
      properties: {
        movements: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              date: { type: "string", pattern: DAY.source },
              description: { type: "string" },
              amount: { type: "number", description: "Positive" },
              type: { type: "string", enum: ["expense", "income"], description: "default expense" },
            },
            required: ["date", "amount"],
            additionalProperties: false,
          },
        },
        tolerance_days: { type: "number", minimum: 0, maximum: 7, description: "default 1" },
      },
      required: ["movements"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const tol = a.tolerance_days == null ? 1 : Number(a.tolerance_days);
      const moves = ((a.movements as Record<string, unknown>[]) ?? []).map((m, i) => {
        if (!DAY.test(String(m.date))) throw new Error(`movement ${i + 1}: date must be YYYY-MM-DD`);
        const amount = Math.abs(Number(m.amount));
        if (!Number.isFinite(amount)) throw new Error(`movement ${i + 1}: amount must be a number`);
        return { date: String(m.date), description: String(m.description ?? ""), amount, type: String(m.type || "expense") };
      });
      if (!moves.length) throw new Error("movements must be a non-empty array");
      const dates = moves.map((m) => m.date).sort();
      const from = dates[0], to = dates[dates.length - 1];
      const recorded = await ctx.rows.list("expenses", { field: "date", from: shiftDay(from, -tol), to: shiftDay(to, tol) });
      const used = new Set<string>();
      const matches: unknown[] = [], missing: unknown[] = [];
      for (const m of moves) {
        const words = loose(m.description).split(" ").filter((w) => w.length > 2);
        // Closest date first, then a shared word in the name, so near-duplicates pair up sensibly.
        const hit = recorded
          .filter((g) => !used.has(g.id) && String(g.type || "expense") === m.type && Math.abs((Number(g.amount) || 0) - m.amount) < 0.01)
          .map((g) => ({ g, days: dayDiff(String(g.date), m.date), named: words.some((w) => loose(g.title).includes(w)) }))
          .filter((c) => c.days <= tol)
          .sort((x, y) => x.days - y.days || Number(y.named) - Number(x.named))[0];
        if (hit) {
          used.add(hit.g.id);
          matches.push({ movement: m, recorded: { id: hit.g.id, date: hit.g.date, title: hit.g.title, category: hit.g.category } });
        } else missing.push(m);
      }
      const appOnly = recorded
        .filter((g) => !used.has(g.id) && String(g.date) >= from && String(g.date) <= to && g.type !== "transfer")
        .map((g) => ({ id: g.id, date: g.date, title: g.title, amount: g.amount, type: g.type }));
      return { period: { from, to }, matched: matches.length, missing, appOnly, matches };
    },
  },
  recurring_expenses: {
    description:
      "Expenses and income that repeat month after month (same name in at least 2 of the last `lookback` months) and are not yet in " +
      "`month` (default this month), with their last amount, category and usual day. Adds nothing: confirm with the user, then add_expenses.",
    inputSchema: {
      type: "object",
      properties: { month: monthArg, lookback: { type: "number", minimum: 2, maximum: 12, description: "default 3" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const month = String(a.month || todayOf(ctx).slice(0, 7));
      const lookback = Number(a.lookback) || 3;
      const past = await ctx.rows.list("expenses", { field: "date", from: `${shiftMonth(month, -lookback)}-01`, to: `${shiftMonth(month, -1)}-31` });
      const key = (g: Item) => `${g.type}|${loose(g.title)}`;
      const have = new Set((await monthItems(ctx, month)).map(key));
      const seen = new Map<string, { months: Set<string>; last: Item }>();
      for (const g of past) {
        if (!loose(g.title) || g.type === "transfer") continue;
        const e = seen.get(key(g)) ?? { months: new Set<string>(), last: g };
        e.months.add(String(g.date).slice(0, 7));
        if (String(g.date) > String(e.last.date)) e.last = g;
        seen.set(key(g), e);
      }
      const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
      const suggestions = [...seen.entries()]
        .filter(([k, e]) => e.months.size >= 2 && !have.has(k))
        .map(([, e]) => {
          const day = Math.min(Number(String(e.last.date).slice(8, 10)) || 1, lastDay);
          const { title, type, category, account, amount } = e.last;
          return { title, type, category, account, amount, date: `${month}-${String(day).padStart(2, "0")}`, monthsSeen: e.months.size };
        })
        .sort((x, y) => x.date.localeCompare(y.date));
      return { month, lookback, suggestions };
    },
  },
  backlog_stats: {
    description: "Overview of the games, books, movies and wines libraries (or one): how many per status, finished this year, average score and top tags.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string", enum: Object.keys(STATS) }, year: { type: "string", pattern: "^\\d{4}$", description: "default this year" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const year = String(a.year || todayOf(ctx).slice(0, 4));
      const out: Record<string, unknown> = { year };
      for (const key of a.collection ? [String(a.collection)] : Object.keys(STATS)) {
        const st = STATS[key], s = schemaOf(key);
        const items = await ctx.rows.list(key);
        const byStatus: Record<string, number> = {};
        for (const g of items) byStatus[String(g[s.statusField] ?? "")] = (byStatus[String(g[s.statusField] ?? "")] ?? 0) + 1;
        const scores = st.score ? items.map((g) => g[st.score!]).filter((v): v is number => typeof v === "number") : [];
        const tagCount = new Map<string, number>();
        for (const g of items) for (const t of (g[st.tags] as string[]) || []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
        out[key] = {
          total: items.length,
          byStatus,
          ...(key !== "wines" && { finishedThisYear: items.filter((g) => g[s.statusField] === st.done && st.doneYear(g) === year).length }),
          ...(scores.length && { averageScore: money(scores.reduce((x, y) => x + y, 0) / scores.length), scored: scores.length }),
          topTags: [...tagCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })),
        };
      }
      return out;
    },
  },
  pick_next: {
    description:
      "Suggest what to play, read or watch next: random picks from the backlog (or another status), optionally only with some tags " +
      "(games) or genres (books, movies) and up to a maximum length (games: hours to beat, books: pages, movies: minutes).",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: ["games", "books", "movies"] },
        status: { type: "string", description: "default backlog" },
        tags: { type: "array", items: { type: "string" }, description: "Any of these" },
        max_length: { type: "number", minimum: 0 },
        count: { type: "number", minimum: 1, maximum: 10, description: "default 3" },
      },
      required: ["collection"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const key = String(a.collection);
      const st = STATS[key], s = schemaOf(key);
      if (!st.length) throw new Error(`pick_next works on games, books and movies`);
      const status = String(a.status || "backlog");
      const tags = ((a.tags as string[]) || []).map(loose);
      const max = a.max_length == null ? null : Number(a.max_length);
      const pool = (await ctx.rows.list(key)).filter((g) => {
        if (g[s.statusField] !== status) return false;
        if (tags.length && !((g[st.tags] as string[]) || []).some((t) => tags.includes(loose(t)))) return false;
        const len = g[st.length!.field];
        return max == null || (typeof len === "number" && len <= max);
      });
      const picks = [...pool];
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      return { poolSize: pool.length, lengthUnit: st.length!.unit, picks: picks.slice(0, Number(a.count) || 3) };
    },
  },
  list_trips: {
    description: "The user's trips (own and shared with them) with dates, budget, spent so far and how many cards each has per status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async run(_a, ctx) {
      const [trips, cards] = await Promise.all([ctx.rows.list("trips"), ctx.rows.list("trip_cards")]);
      return trips
        .map((t) => {
          const mine = cards.filter((c) => c.trip === t.id);
          const byStatus: Record<string, number> = {};
          for (const c of mine) byStatus[String(c.status)] = (byStatus[String(c.status)] ?? 0) + 1;
          return {
            id: t.id, name: t.name, subtitle: t.subtitle, start: t.start, end: t.end, dayCount: t.dayCount, currency: t.currency,
            budget: t.budget, spent: money(mine.reduce((x, c) => x + (Number(c.price) || 0), 0)), cards: mine.length, byStatus,
          };
        })
        .sort((x, y) => String(y.start ?? "").localeCompare(String(x.start ?? "")));
    },
  },
  list_trip_cards: {
    description: "Cards of one trip (places, food, lodging, to-dos…) in itinerary order: by day, unscheduled pool last, then the planner's order.",
    inputSchema: {
      type: "object",
      properties: {
        trip: { type: "string", description: "Trip id (list_trips)" },
        day: { type: ["number", "null"], description: "Only this day; null for the unscheduled pool" },
        status: { type: "string", enum: TRIP_CARD_STATUSES },
        type: { type: "string", enum: TRIP_CARD_TYPES },
        query: { type: "string" },
      },
      required: ["trip"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(a, ctx) {
      const t = await tripOf(ctx, a.trip);
      let cards = (await ctx.rows.list("trip_cards")).filter((c) => c.trip === t.id);
      if (a.day !== undefined) cards = cards.filter((c) => (c.day ?? null) === a.day);
      if (a.status) cards = cards.filter((c) => c.status === a.status);
      if (a.type) cards = cards.filter((c) => c.type === a.type);
      if (a.query) {
        const q = loose(a.query);
        cards = cards.filter((c) => loose([c.title, c.region, c.notes, ...((c.tags as string[]) || [])].join(" ")).includes(q));
      }
      const dayKey = (c: Item) => (c.day == null ? Infinity : Number(c.day));
      const orderKey = (c: Item) => (c.order == null ? Infinity : Number(c.order));
      cards.sort((x, y) => dayKey(x) - dayKey(y) || orderKey(x) - orderKey(y) || 0);
      return { trip: { id: t.id, name: t.name, start: t.start, end: t.end, dayCount: t.dayCount, currency: t.currency }, cards };
    },
  },
  add_trip_cards: {
    description: "Add cards (places to see, restaurants, lodging, transport, to-dos…) to a trip. Without `day` they go to the trip's pool.",
    inputSchema: {
      type: "object",
      properties: {
        trip: { type: "string", description: "Trip id (list_trips)" },
        cards: { type: "array", minItems: 1, items: { type: "object", properties: cardProps, required: ["title"], additionalProperties: false } },
      },
      required: ["trip", "cards"],
      additionalProperties: false,
    },
    async run(a, ctx) {
      const t = await tripOf(ctx, a.trip);
      const list = a.cards;
      if (!Array.isArray(list) || !list.length) throw new Error("cards must be a non-empty array");
      const now = (ctx.now ?? (() => new Date()))().getTime();
      const existing = (await ctx.rows.list("trip_cards")).filter((c) => c.trip === t.id);
      // After every card already there, so they show up last in the pool or their day.
      let order = existing.reduce((m, c) => Math.max(m, c.order == null ? -1 : Number(c.order)), existing.length - 1);
      const base = { trip: t.id, title: "", type: "place", status: "idea", tags: [], price: null, region: "", notes: "", source: "", startTime: "", duration: "", priority: "nice", day: null, addedBy: "Me" };
      const cards = list.map((raw: Record<string, unknown>) => (checkCardKeys(raw), { ...cleanCard({ ...base, ...raw }), id: cardId(now), order: ++order }));
      await ctx.rows.put("trip_cards", cards);
      return { trip: t.name, added: cards };
    },
  },
  update_trip_card: {
    description: "Change some fields of one trip card, e.g. mark it booked, move it to a day or set its price.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, patch: { type: "object", properties: cardProps, additionalProperties: false } },
      required: ["id", "patch"],
      additionalProperties: false,
    },
    async run(a, ctx) {
      const cur = await ctx.rows.get("trip_cards", String(a.id));
      if (!cur) throw new Error(`No trip card with id ${a.id}`);
      const patch = (a.patch ?? {}) as Record<string, unknown>;
      checkCardKeys(patch);
      const next = { ...cleanCard({ ...cur, ...patch }), id: cur.id, trip: cur.trip } as Item;
      await ctx.rows.put("trip_cards", [next]);
      return { updated: next };
    },
  },
};

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
  ...Object.fromEntries(
    COLLECTIONS.map((s): [string, Tool] => [
      `update_${s.key}`,
      {
        description: `Change some fields of one ${s.noun} (id from list_items); \`patch\` holds only the fields to change.`,
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" }, patch: { ...itemSchema(s), required: undefined, minProperties: 1 } },
          required: ["id", "patch"],
          additionalProperties: false,
        },
        async run(a, ctx) {
          const patch = (a.patch ?? {}) as Record<string, unknown>;
          checkKeys(s, patch);
          const cur = await ctx.rows.get(s.key, String(a.id));
          if (!cur) throw new Error(`No ${s.noun} with id ${a.id} in ${s.key}`);
          const next = { ...normalize(s, { ...cur, ...patch }), id: cur.id } as Item;
          await ctx.rows.put(s.key, [next]);
          return { updated: next };
        },
      },
    ]),
  ),
  ...EXTRA_TOOLS,
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

export const SERVER_INFO = { name: "backlog", version: "0.3.0" };

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
            "The user's personal Backlog: games, books, movies, wines, expenses and trips. " +
            "Amounts are in the user's currency (ARS). Dates are YYYY-MM-DD in the user's time zone. " +
            "Check list_items before adding when a duplicate is plausible. " +
            "reconcile_statement and recurring_expenses only suggest: show the user what would be added and add with add_expenses once they agree.",
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
