"use client";

// Email/password auth against Supabase (Backlog.dc.html's auth flow). The
// session is persisted by supabase-js in localStorage, so it is shared with
// the legacy app on the same origin.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { errorMessage, getSupabase } from "@/lib/supabase";

export type AuthStatus = "loading" | "unconfigured" | "signedOut" | "signedIn";

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthMode = "signin" | "signup";

/** `error` blocks; `notice` is informational (e.g. "check your email"). */
export interface AuthResult {
  error?: string;
  notice?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  submit(mode: AuthMode, email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** Client-side checks before calling Supabase (same rules and messages as legacy). */
export function validateCredentials(email: string, password: string): string | null {
  if (!email.trim() || !password) return "Enter your email and password.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

const toUser = (s: Session | null): AuthUser | null => (s ? { id: s.user.id, email: s.user.email ?? "" } : null);

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const sb = getSupabase();
  const [status, setStatus] = useState<AuthStatus>(sb ? "loading" : "unconfigured");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!sb) return;
    let active = true;
    const apply = (s: Session | null) => {
      if (!active) return;
      const next = toUser(s);
      // Token refreshes re-fire for the same user: keep the object stable.
      setUser((cur) => (cur && next && cur.id === next.id ? cur : next));
      setStatus(next ? "signedIn" : "signedOut");
    };
    sb.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));
    const { data } = sb.auth.onAuthStateChange((_evt, s) => apply(s));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async submit(mode, rawEmail, password) {
        if (!sb) return { error: "Supabase is not configured." };
        const email = rawEmail.trim();
        const invalid = validateCredentials(email, password);
        if (invalid) return { error: invalid };
        try {
          if (mode === "signup") {
            const res = await sb.auth.signUp({ email, password });
            if (res.error) throw res.error;
            if (!res.data.session) return { notice: "Account created — check your email to confirm, then sign in." };
            return {};
          }
          const res = await sb.auth.signInWithPassword({ email, password });
          if (res.error) throw res.error;
          return {};
        } catch (e) {
          return { error: errorMessage(e) };
        }
      },
      async signOut() {
        try {
          await sb?.auth.signOut();
        } catch {}
        setUser(null);
        setStatus(sb ? "signedOut" : "unconfigured");
      },
    }),
    [sb, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Dev preview only: a fixed signed-in user, no Supabase. */
export function PreviewAuthProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({ status: "signedIn", user, submit: async () => ({}), signOut: async () => {} }),
    [user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
