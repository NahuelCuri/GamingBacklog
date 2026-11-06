// Local MCP server (stdio) over the user's own Backlog data, for Claude Code.
// Same tables and row shape as lib/data/store.ts, signed in as the user (see client.mjs),
// so it can only see and change what the page can. Sign in once with `npm run mcp:login`.
import { createInterface } from "node:readline";
import { makeClient, requireUser } from "./client.mjs";

const COLLECTIONS = ["games", "books", "wines", "movies", "expenses"];
const SHARED = new Set(["wines"]);
const EXPENSE_TYPES = ["expense", "income", "transfer"];

const sb = makeClient();

// ---------------------------------------------------------------- data

function table(c) {
  if (!COLLECTIONS.includes(c)) throw new Error(`Unknown collection "${c}". One of: ${COLLECTIONS.join(", ")}`);
  return c;
}
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return (data ?? []).map((r) => r.data).filter(Boolean);
};
const check = async (p) => {
  const { error } = await p;
  if (error) throw error;
};
const nextMonth = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};

let idSeq = 0;
// Same "x" + timestamp ids the page makes; the counter keeps a batch unique.
const newId = () => "x" + (Date.now() + idSeq++);

/** Expenses have a fixed shape (config/collections/expenses.ts); anything else is stored as given. */
function normalize(c, it) {
  if (c !== "expenses") return it;
  const out = {
    title: String(it.title ?? "").trim(),
    type: it.type ?? "expense",
    category: String(it.category ?? "").trim(),
    account: String(it.account ?? "").trim(),
    amount: Number(it.amount),
    date: String(it.date ?? ""),
    notes: String(it.notes ?? ""),
  };
  if (!out.title) throw new Error("expense needs a title");
  if (!EXPENSE_TYPES.includes(out.type)) throw new Error(`type must be one of ${EXPENSE_TYPES.join(", ")}`);
  if (!(out.amount > 0)) throw new Error(`amount must be a positive number (got ${it.amount}); the type says which way money went`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error(`date must be YYYY-MM-DD (got ${it.date})`);
  return { ...it, ...out };
}

async function rowFor(c, item) {
  const user = await requireUser(sb);
  return SHARED.has(c)
    ? { row: { id: item.id, data: item, added_by: user.id, updated_at: new Date().toISOString() }, onConflict: "id" }
    : { row: { user_id: user.id, id: item.id, data: item }, onConflict: "user_id,id" };
}

const tools = {
  whoami: {
    description: "Who the MCP is signed in as.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const u = await requireUser(sb);
      return { email: u.email, id: u.id };
    },
  },
  list_items: {
    description:
      "List items of a collection. For expenses pass `month` (YYYY-MM) or a `from`/`to` date range (YYYY-MM-DD, inclusive) to keep it small.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: COLLECTIONS },
        month: { type: "string", description: "YYYY-MM" },
        from: { type: "string", description: "YYYY-MM-DD, inclusive" },
        to: { type: "string", description: "YYYY-MM-DD, inclusive" },
      },
      required: ["collection"],
    },
    async run({ collection, month, from, to }) {
      await requireUser(sb);
      let q = sb.from(table(collection)).select("data");
      if (month) q = q.gte("data->>date", `${month}-01`).lt("data->>date", `${nextMonth(month)}-01`);
      if (from) q = q.gte("data->>date", from);
      if (to) q = q.lte("data->>date", to);
      const items = unwrap(await q);
      items.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
      return { count: items.length, items };
    },
  },
  add_items: {
    description:
      "Add new items. Expenses: { title, type: expense|income|transfer, category, amount (positive), date: YYYY-MM-DD, notes?, account? (transfers: Savings|Investing|USD) }. Ids are generated.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string", enum: COLLECTIONS }, items: { type: "array", items: { type: "object" } } },
      required: ["collection", "items"],
    },
    async run({ collection, items }) {
      const c = table(collection);
      const list = items.map((it) => ({ ...normalize(c, it), id: newId() }));
      const rows = await Promise.all(list.map((g) => rowFor(c, g)));
      if (rows.length) await check(sb.from(c).upsert(rows.map((r) => r.row), { onConflict: rows[0].onConflict }));
      return { added: list };
    },
  },
  update_item: {
    description: "Change fields of one item; `patch` is merged into it.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string", enum: COLLECTIONS }, id: { type: "string" }, patch: { type: "object" } },
      required: ["collection", "id", "patch"],
    },
    async run({ collection, id, patch }) {
      const c = table(collection);
      await requireUser(sb);
      const [cur] = unwrap(await sb.from(c).select("data").eq("id", id));
      if (!cur) throw new Error(`No item ${id} in ${c}`);
      const next = { ...normalize(c, { ...cur, ...patch }), id };
      const { row, onConflict } = await rowFor(c, next);
      await check(sb.from(c).upsert(row, { onConflict }));
      return { updated: next };
    },
  },
  delete_items: {
    description: "Delete items by id. Permanent: confirm with the user first.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string", enum: COLLECTIONS }, ids: { type: "array", items: { type: "string" } } },
      required: ["collection", "ids"],
    },
    async run({ collection, ids }) {
      const c = table(collection);
      const user = await requireUser(sb);
      let q = sb.from(c).delete().in("id", ids);
      if (!SHARED.has(c)) q = q.eq("user_id", user.id);
      await check(q);
      return { deleted: ids };
    },
  },
};

// ---------------------------------------------------------------- JSON-RPC over stdio

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");

async function handle({ id, method, params }) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "backlog", version: "0.1.0" },
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) };
    case "tools/call": {
      const t = tools[params?.name];
      if (!t) throw Object.assign(new Error(`Unknown tool ${params?.name}`), { code: -32602 });
      try {
        const out = await t.run(params.arguments ?? {});
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e?.message || String(e) }] };
      }
    }
    default:
      if (id === undefined) return; // notifications need no answer
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ id: null, error: { code: -32700, message: "Parse error" } });
  }
  try {
    const result = await handle(msg);
    if (msg.id !== undefined) send({ id: msg.id, result });
  } catch (e) {
    if (msg.id !== undefined) send({ id: msg.id, error: { code: e.code ?? -32603, message: e.message } });
  }
});
