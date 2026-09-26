"use client";

// Renders children only for a signed-in user; otherwise the loading line, the
// "connect Supabase" notice, or the sign-in card (legacy auth gate).
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth, type AuthMode } from "@/lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "signedIn") return <>{children}</>;
  if (status === "loading") {
    return <div className="flex min-h-dvh items-center justify-center font-mono text-[13px] text-dim">loading…</div>;
  }
  if (status === "unconfigured") return <ConfigMissing />;
  return <AuthCard />;
}

function ConfigMissing() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-[440px] max-w-full rounded-2xl border border-wf bg-surface p-7">
        <div className="mb-2.5 text-base font-bold">Connect Supabase</div>
        <div className="text-[13px] leading-[1.65] text-muted">
          Set <span className="font-mono text-text2">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
          <span className="font-mono text-text2">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> (see <span className="font-mono text-text2">.env.example</span>) to
          enable login and cloud sync.
        </div>
      </div>
    </div>
  );
}

const field =
  "w-full rounded-[9px] border border-wh bg-inset px-3 py-2.5 text-sm text-text";

function AuthCard() {
  const { submit } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await submit(mode, email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.notice) {
      setMode("signin");
      setError(res.notice);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-[380px] max-w-full rounded-2xl border border-wf bg-surface px-7 pt-[30px] pb-[26px]">
        <div className="mb-1 flex items-baseline gap-[9px]">
          <span translate="no" className="text-xl font-bold tracking-[-.02em]">Backlog</span>
          <span className="font-mono text-[11px] text-dim">{"// games"}</span>
        </div>
        <div className="mb-[22px] text-[13px] text-muted">{signup ? "Create an account to start syncing." : "Sign in to your backlog."}</div>
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="auth-email" className="mb-[7px] block text-[10px] font-semibold tracking-[.09em] text-dim uppercase">
            Email
          </label>
          <input
            id="auth-email"
            className={field + " mb-[15px]"}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="auth-password" className="mb-[7px] block text-[10px] font-semibold tracking-[.09em] text-dim uppercase">
            Password
          </label>
          <input
            id="auth-password"
            className={field + " mb-[2px]"}
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div role="alert" className="mt-2.5 mb-[2px] text-xs leading-[1.5] text-[#d98f8f]">
              {error}
            </div>
          )}
          <button
            type="submit"
            aria-busy={busy}
            className="mt-4 w-full cursor-pointer rounded-[10px] bg-accent p-3 text-sm font-bold text-on-accent"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="mt-[18px] text-center text-[12.5px] text-muted">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold text-accent"
            onClick={() => {
              setMode(signup ? "signin" : "signup");
              setError("");
            }}
          >
            {signup ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
