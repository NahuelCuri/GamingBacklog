// Supabase client for the local MCP server and its login script. Signs in as
// the user (anon key + their session), so RLS scopes every row exactly as the page does.
// The session lives in ~/.backlog-mcp/session.json, outside the repo.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SESSION_FILE = join(homedir(), ".backlog-mcp", "session.json");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(join(ROOT, f));
    } catch {}
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env.local");
  return { url, key };
}

// supabase-js storage adapter backed by one JSON file; refresh tokens rotate, so writes must stick.
const fileStorage = {
  read() {
    try {
      return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
    } catch {
      return {};
    }
  },
  getItem(k) {
    return this.read()[k] ?? null;
  },
  setItem(k, v) {
    const all = { ...this.read(), [k]: v };
    mkdirSync(dirname(SESSION_FILE), { recursive: true });
    writeFileSync(SESSION_FILE, JSON.stringify(all), { mode: 0o600 });
  },
  removeItem(k) {
    const all = this.read();
    delete all[k];
    if (Object.keys(all).length) writeFileSync(SESSION_FILE, JSON.stringify(all), { mode: 0o600 });
    else rmSync(SESSION_FILE, { force: true });
  },
};

export function makeClient() {
  const { url, key } = loadEnv();
  return createClient(url, key, { auth: { storage: fileStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

/** The signed-in user, or throws with how to sign in. */
export async function requireUser(sb) {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in. Run `npm run mcp:login` in a terminal first.");
  return data.user;
}
