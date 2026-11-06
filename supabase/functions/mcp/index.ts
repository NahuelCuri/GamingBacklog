// Remote MCP endpoint (Streamable HTTP, stateless) for Claude web/desktop/mobile.
// Auth is Supabase's own OAuth 2.1 server: the bearer token is the user's Supabase JWT,
// so queries run under RLS exactly like the page. Only ids in MCP_ALLOWED_USERS get in.
//   POST /mcp                                   JSON-RPC (one message or a batch)
//   GET  /mcp/.well-known/oauth-protected-resource  where to sign in (RFC 9728)
//   GET  /mcp/access                            { allowed } for the consent page
// Deploy: npx supabase functions deploy mcp --no-verify-jwt  (it checks tokens itself, to answer 401 properly)
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { handleRpc, supabaseRows } from "../_shared/backlog-tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ALLOWED = new Set((Deno.env.get("MCP_ALLOWED_USERS") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const TZ = Deno.env.get("MCP_TZ") ?? "America/Argentina/Buenos_Aires";

const RESOURCE = `${SUPABASE_URL}/functions/v1/mcp`;
const METADATA = `${RESOURCE}/.well-known/oauth-protected-resource`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, apikey, x-client-info",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...headers } });

const unauthorized = () =>
  json({ error: "unauthorized" }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${METADATA}"` });

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: RESOURCE,
      authorization_servers: [`${SUPABASE_URL}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_name: "Backlog",
    });
  }

  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized();
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return unauthorized();
  const user = data.user;
  const allowed = ALLOWED.has(user.id);

  if (path.endsWith("/access")) return json({ allowed });
  if (!allowed) return json({ error: "forbidden", message: "This Backlog connector is private." }, 403);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, { Allow: "POST" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const ctx = { rows: supabaseRows(sb, user.id), user: { id: user.id, email: user.email }, tz: TZ };
  const batch = Array.isArray(body);
  const replies = [];
  // In order, so a list after an add in the same batch sees it.
  for (const msg of batch ? body : [body]) {
    const r = await handleRpc(msg, ctx);
    if (r) replies.push(r);
  }
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? replies : replies[0]);
});
