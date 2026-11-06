// Local MCP server (stdio) over the user's own Backlog data, for Claude Code.
// The tools live in supabase/functions/_shared/backlog-tools.ts, shared with the
// remote Edge Function; this only signs in as the user (see client.mjs) and speaks stdio.
// Sign in once with `npm run mcp:login`.
import { createInterface } from "node:readline";
import { handleRpc, supabaseRows } from "../../supabase/functions/_shared/backlog-tools.ts";
import { makeClient, requireUser } from "./client.mjs";

const sb = makeClient();
const tz = process.env.MCP_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Signed in lazily so `initialize` and `tools/list` work before `mcp:login`. */
async function ctx() {
  const user = await requireUser(sb);
  return { rows: supabaseRows(sb, user.id), user: { id: user.id, email: user.email }, tz };
}
const signedOut = (e) => ({
  rows: { list: () => Promise.reject(e), get: () => Promise.reject(e), put: () => Promise.reject(e), remove: () => Promise.reject(e) },
  user: { id: "", email: null },
  tz,
});

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

// One message at a time, so a list sent after an add sees it.
let queue = Promise.resolve();
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  queue = queue.then(async () => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
    const c = msg.method === "tools/call" ? await ctx().catch(signedOut) : signedOut(new Error("not needed"));
    const reply = await handleRpc(msg, c);
    if (reply) send(reply);
  });
});
