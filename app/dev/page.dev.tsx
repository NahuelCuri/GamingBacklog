"use client";

// Development-only tools: sign in, inspect a collection's load state, export /
// import, and copy production localStorage into localhost. Renders nothing
// useful in a production build.
import { useState, type ChangeEvent, type FormEvent } from "react";
import { COLLECTIONS, COLLECTION_KEYS } from "@/config/collections";
import { useAuth, type AuthMode } from "@/lib/auth";
import type { CollectionKey } from "@/lib/collection/types";
import { canTransfer } from "@/lib/data/collection-state";
import { isShared } from "@/lib/data/store";
import { parseImport } from "@/lib/data/transfer";
import { useCollection } from "@/lib/data/useCollection";
import { useStore } from "@/lib/data/useStore";

const IS_DEV = process.env.NODE_ENV === "development";

const card = "rounded-2xl border border-wf bg-surface p-5 flex flex-col gap-3";
const btn =
  "cursor-pointer rounded-lg border border-wf bg-chip px-3 py-1.5 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40";
const input = "rounded-lg border border-wf bg-inset px-3 py-2 text-sm text-text";

export default function DevPage() {
  if (!IS_DEV) return <p className="p-8 text-muted">Only available in development.</p>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-10">
      <h1 className="text-2xl font-extrabold">Dev tools</h1>
      <AuthPanel />
      <CollectionPanel />
      <StorageImportPanel />
    </main>
  );
}

function AuthPanel() {
  const { status, user, submit, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await submit(mode, email, password);
    setBusy(false);
    if (res.error) setMsg({ text: res.error, error: true });
    else if (res.notice) {
      setMsg({ text: res.notice, error: false });
      setMode("signin");
    } else {
      setMsg(null);
      setPassword("");
    }
  };

  return (
    <section className={card}>
      <h2 className="font-bold">Auth</h2>
      <p className="font-mono text-xs text-muted">
        status: {status}
        {user && ` · ${user.email} · ${user.id}`}
      </p>
      {status === "signedIn" && (
        <button className={btn + " self-start"} onClick={signOut}>
          Sign out
        </button>
      )}
      {status === "signedOut" && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <input className={input} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex items-center gap-3">
            <button className={btn} type="submit" disabled={busy}>
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button type="button" className="cursor-pointer text-sm text-accent" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "New here? Create one" : "Have an account? Sign in"}
            </button>
          </div>
        </form>
      )}
      {msg && <p className={"text-sm " + (msg.error ? "text-[#d98f8f]" : "text-accent")}>{msg.text}</p>}
    </section>
  );
}

function CollectionPanel() {
  const [key, setKey] = useState<CollectionKey>("games");
  const store = useStore(key);
  const { state, actions } = useCollection(key, store);
  const [importMsg, setImportMsg] = useState("");
  const cfg = COLLECTIONS[key];

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !actions) return;
    const parsed = parseImport(await file.text(), cfg);
    if (!parsed.ok) return setImportMsg(parsed.error);
    const warn = isShared(key) ? " This collection is shared: it replaces everyone's data." : "";
    if (!confirm(`Replace ${state.items.length} ${cfg.nounPlural} with ${parsed.items.length}? A backup downloads first.${warn}`)) return;
    await actions.importReplace(parsed.items);
    setImportMsg(`Imported ${parsed.items.length}.`);
  };

  return (
    <section className={card}>
      <h2 className="font-bold">Collection data</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select className={input} value={key} onChange={(e) => setKey(e.target.value as CollectionKey)}>
          {COLLECTION_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
              {isShared(k) ? " (shared)" : ""}
            </option>
          ))}
        </select>
        <button className={btn} disabled={!actions} onClick={() => actions?.refresh()}>
          Refresh
        </button>
        <button className={btn} disabled={!actions || !canTransfer(state)} onClick={() => actions?.exportNow()}>
          Export JSON
        </button>
        <label className={btn + (canTransfer(state) ? "" : " pointer-events-none opacity-40")}>
          Import JSON…
          <input type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </label>
      </div>
      {!store ? (
        <p className="text-sm text-muted">Sign in to load data.</p>
      ) : (
        <p className="font-mono text-xs text-muted">
          status: {state.status} · {state.items.length} {cfg.nounPlural}
        </p>
      )}
      {state.loadError && <p className="text-sm text-[#d98f8f]">Load failed: {state.loadError}</p>}
      {state.syncError && (
        <p className="text-sm text-[#d98f8f]">
          Sync failed: {state.syncError}{" "}
          <button className="cursor-pointer underline" onClick={() => actions?.dismissSyncError()}>
            dismiss
          </button>
        </p>
      )}
      {importMsg && <p className="text-sm text-muted">{importMsg}</p>}
    </section>
  );
}

/** Writes a `JSON.stringify(localStorage)` dump from production into this origin. */
function StorageImportPanel() {
  const [text, setText] = useState("");
  const [skipAuth, setSkipAuth] = useState(true);
  const [msg, setMsg] = useState("");

  const apply = () => {
    let dump: unknown;
    try {
      dump = JSON.parse(text);
    } catch {
      return setMsg("Not valid JSON.");
    }
    if (!dump || typeof dump !== "object" || Array.isArray(dump)) return setMsg("Expected an object of key → value.");
    const written: string[] = [];
    for (const [k, v] of Object.entries(dump as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      if (skipAuth && /^sb-.*-auth-token$/.test(k)) continue;
      localStorage.setItem(k, v);
      written.push(k);
    }
    setMsg(written.length ? `Wrote ${written.length} keys: ${written.join(", ")}` : "Nothing to write.");
  };

  return (
    <section className={card}>
      <h2 className="font-bold">Import localStorage from production</h2>
      <p className="text-sm text-muted">
        In the production app&apos;s console run <code className="font-mono text-text2">copy(JSON.stringify(localStorage))</code>, then
        paste here.
      </p>
      <textarea className={input + " h-28 font-mono text-xs"} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={skipAuth} onChange={(e) => setSkipAuth(e.target.checked)} />
        Skip Supabase session tokens (sign in here instead)
      </label>
      <button className={btn + " self-start"} disabled={!text.trim()} onClick={apply}>
        Write keys
      </button>
      {msg && <p className="break-all text-sm text-muted">{msg}</p>}
    </section>
  );
}
