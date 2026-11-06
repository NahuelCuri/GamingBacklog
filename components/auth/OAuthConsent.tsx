"use client";

// Consent screen for Supabase's OAuth server (Authentication → OAuth Server → Authorization Path):
// an app such as Claude asks to use this Backlog through the MCP Edge Function. Signed-in only
// (AuthGate); people not on the function's allow-list are told it's private before they approve.
import { useEffect, useState } from "react";
import { accentButton, secondaryButton } from "@/components/ui/Pills";
import { useAuth } from "@/lib/auth";
import { errorMessage, getSupabase } from "@/lib/supabase";

type Details = { client: { name: string; uri: string }; redirect_uri: string; scope: string };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "private" }
  | { kind: "ask"; details: Details }
  | { kind: "leaving" };

/** Whether the MCP function lets this user in; the function's check is the real gate. */
async function mcpAccess(token: string): Promise<boolean> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp/access`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
  });
  if (!res.ok) throw new Error(`The connector didn't answer (${res.status}).`);
  return !!(await res.json()).allowed;
}

export function OAuthConsent() {
  const { user } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
    const sb = getSupabase();
    if (!authorizationId || !sb) {
      setState({ kind: "error", message: "This link is missing its authorization request." });
      return;
    }
    setId(authorizationId);
    (async () => {
      try {
        const { data, error } = await sb.auth.oauth.getAuthorizationDetails(authorizationId);
        if (error) throw error;
        // Approved before: straight back to the app.
        if ("redirect_url" in data) {
          setState({ kind: "leaving" });
          window.location.replace(data.redirect_url);
          return;
        }
        const token = (await sb.auth.getSession()).data.session?.access_token;
        if (!token || !(await mcpAccess(token))) setState({ kind: "private" });
        else setState({ kind: "ask", details: data });
      } catch (e) {
        setState({ kind: "error", message: errorMessage(e) });
      }
    })();
  }, []);

  const decide = async (approve: boolean) => {
    const sb = getSupabase();
    if (!sb || !id) return;
    setState({ kind: "leaving" });
    const { data, error } = approve
      ? await sb.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await sb.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
    if (error) setState({ kind: "error", message: errorMessage(error) });
    else window.location.replace(data.redirect_url);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-[420px] max-w-full rounded-2xl border border-wf bg-surface px-7 pt-[30px] pb-[26px]">
        <div className="mb-4 flex items-baseline gap-[9px]">
          <span translate="no" className="text-xl font-bold tracking-[-.02em]">Backlog</span>
          <span className="font-mono text-[11px] text-dim">{"// connect an app"}</span>
        </div>

        {(state.kind === "loading" || state.kind === "leaving") && (
          <div aria-busy="true" className="font-mono text-xs text-dim motion-safe:animate-pulse">
            {state.kind === "loading" ? "loading…" : "Returning to the app…"}
          </div>
        )}

        {state.kind === "error" && (
          <div role="alert" className="text-[13px] leading-[1.6] text-neg">
            {state.message}
          </div>
        )}

        {state.kind === "private" && (
          <>
            <div className="mb-1.5 text-base font-bold">This connector is private</div>
            <div className="mb-5 text-[13px] leading-[1.6] text-muted">Only its owner can connect apps to it.</div>
            <button type="button" onClick={() => decide(false)} className={secondaryButton + " w-full rounded-[10px] p-3 text-sm"}>
              Go back
            </button>
          </>
        )}

        {state.kind === "ask" && (
          <>
            <div className="mb-1.5 text-base font-bold">
              <span translate="no">{state.details.client.name || "An app"}</span> <span>wants to use your Backlog</span>
            </div>
            <div className="mb-4 text-[13px] leading-[1.6] text-muted">It will be able to read, add, edit and delete items in every library.</div>
            <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-dim">Account</dt>
              <dd translate="no" className="truncate text-text2">{user?.email}</dd>
              <dt className="text-dim">Returns to</dt>
              <dd translate="no" className="truncate font-mono text-text2">{new URL(state.details.redirect_uri).host}</dd>
            </dl>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => decide(false)} className={secondaryButton + " flex-1 rounded-[10px] p-3 text-sm"}>
                Deny
              </button>
              <button type="button" onClick={() => decide(true)} className={accentButton + " flex-1 rounded-[10px] p-3 text-sm font-bold"}>
                Allow
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
