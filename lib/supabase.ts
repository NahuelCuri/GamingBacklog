// Browser-only Supabase client (production project; access is enforced by RLS).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** The shared client, or null when the env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  client ??= createClient(URL, KEY);
  return client;
}

/** Postgrest/Auth errors carry `message`; anything else falls back to a generic text. */
export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}
