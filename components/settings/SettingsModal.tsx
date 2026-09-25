"use client";

import { useCallback, useEffect, useState } from "react";
import { MoonIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { Eyebrow, Modal, Switch } from "@/components/ui/Modal";
import { LIBRARIES, isAdmin } from "@/config/libraries";
import { usageView, type AdminUsage } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { errorMessage, getSupabase } from "@/lib/supabase";

const row = "flex items-center gap-[13px] rounded-xl border bg-card px-[14px] py-3";

export function SettingsModal() {
  const { closeSettings, themeMode, setThemeMode, libs, toggleLib } = useShell();
  const { user } = useAuth();

  return (
    <Modal onClose={closeSettings} label="Settings">
      <div className="mb-1 flex items-baseline gap-[9px]">
        <span className="text-lg font-bold tracking-[-.02em]">Settings</span>
        <span className="max-w-[220px] truncate font-mono text-[11px] text-dim">{"// " + (user?.email ?? "")}</span>
      </div>
      <div className="mb-[18px] text-[12.5px] text-muted">Personalize your home screen.</div>

      <Eyebrow>Appearance</Eyebrow>
      <div className={row + " mb-5 border-wd"}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-wf bg-inset text-accent">
          <MoonIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Theme</div>
          <div className="text-[11.5px] text-muted">Switch between dark and light.</div>
        </div>
        <div role="group" aria-label="Theme" className="flex shrink-0 gap-[3px] rounded-[9px] border border-wd bg-inset p-[3px]">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={themeMode === m}
              onClick={() => setThemeMode(m)}
              className="cursor-pointer rounded-md px-[14px] py-1.5 text-[12.5px] font-semibold text-muted transition-colors duration-200 aria-pressed:bg-accent aria-pressed:text-on-accent"
            >
              {m === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </div>

      <Eyebrow>Libraries</Eyebrow>
      <div className="flex flex-col gap-[9px]">
        {LIBRARIES.map((d) => {
          const on = libs.includes(d.key);
          const last = on && libs.length <= 1;
          return (
            <button
              key={d.key}
              type="button"
              role="switch"
              aria-checked={on}
              aria-disabled={last}
              onClick={() => toggleLib(d.key)}
              className={row + " text-left transition-[border-color] duration-200"}
              style={{
                borderColor: on ? `color-mix(in srgb, ${d.color} 42%, transparent)` : "var(--we)",
                cursor: last ? "not-allowed" : "pointer",
                opacity: on ? 1 : 0.66,
              }}
            >
              <div
                className="h-[30px] w-[30px] shrink-0 rounded-lg transition-[background] duration-200"
                style={{ background: on ? d.color : `color-mix(in srgb, ${d.color} 20%, transparent)` }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{d.label}</div>
                <div className="text-[11.5px] text-muted">{d.desc}</div>
              </div>
              <Switch on={on} color={d.color} />
            </button>
          );
        })}
      </div>
      <div className="mt-[14px] min-h-4 text-[11.5px] text-dim">
        {libs.length <= 1 ? "At least one library must stay visible." : `${libs.length} of ${LIBRARIES.length} libraries shown.`}
      </div>

      {isAdmin(user?.id) && <AdminUsagePanel uid={user!.id} />}

      <div className="mt-[14px] flex justify-end">
        <button type="button" onClick={closeSettings} className="cursor-pointer rounded-[9px] bg-accent px-5 py-[9px] text-[13px] font-bold text-on-accent">
          Done
        </button>
      </div>
    </Modal>
  );
}

function AdminUsagePanel({ uid }: { uid: string }) {
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await sb.rpc("admin_usage");
      if (error) throw error;
      setUsage(data as AdminUsage);
    } catch (e) {
      setError(errorMessage(e, "Could not load usage."));
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const v = usage ? usageView(usage, uid) : null;

  return (
    <div className="mt-[22px] border-t border-wf pt-5">
      <div className="mb-[3px] flex items-center gap-[9px]">
        <span className="text-[15px] font-bold tracking-[-.01em]">Administration</span>
        <span className="rounded-[5px] bg-accent px-1.5 py-[2px] text-[9px] font-bold tracking-[.08em] text-on-accent uppercase">Admin</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={load}
          title="Refresh"
          className="cursor-pointer rounded-md border border-wh px-[9px] py-1 font-mono text-[11px] text-muted"
        >
          ↻ Refresh
        </button>
      </div>
      <div className="mb-4 text-[12.5px] text-muted">Supabase database storage — total &amp; per user.</div>

      {error && (
        <div className="rounded-[9px] border px-3 py-2.5 text-xs" style={{ color: "#e6a09c", background: "rgba(230,160,156,.08)", borderColor: "rgba(230,160,156,.25)" }}>
          {error}
        </div>
      )}

      {v && (
        <>
          <div className="rounded-xl border border-we bg-card px-4 py-[15px]">
            <div className="mb-[9px] flex items-baseline justify-between">
              <span className="text-xs text-muted">Total database size</span>
              <span className="font-mono text-[13px] font-bold" style={{ color: v.pctColor }}>
                {v.total} <span className="font-normal text-dim">/ {v.limit}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-[5px] bg-inset">
              <div className="h-full rounded-[5px] transition-[width] duration-400" style={{ width: v.pct, background: v.pctColor }} />
            </div>
            <div className="mt-1.5 font-mono text-[10.5px] text-dim">{v.pct} of quota used</div>
          </div>

          <Eyebrow className="mt-[18px]">By user</Eyebrow>
          <div className="flex flex-col gap-2.5">
            {v.users.map((u) => (
              <div key={u.key}>
                <div className="mb-[5px] flex items-baseline justify-between gap-2.5">
                  <span className="truncate font-mono text-[11.5px]" style={{ color: u.isMe ? "var(--accent)" : "var(--text)" }}>
                    {u.email}
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] font-bold text-text">{u.size}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-inset">
                  <div className="h-full rounded bg-accent opacity-70 transition-[width] duration-400" style={{ width: u.barW }} />
                </div>
              </div>
            ))}
          </div>
          {!v.users.length && <div className="text-xs text-dim">No per-user rows returned.</div>}
        </>
      )}

      {busy && <div className="font-mono text-xs text-dim">Loading usage…</div>}
    </div>
  );
}
