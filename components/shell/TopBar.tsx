"use client";

// Simple page header for routes without a collection toolbar (Trips):
// brand + kicker, back to the picker, settings and sign out.
import type { ReactNode } from "react";
import { GearIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { useAuth } from "@/lib/auth";

export function TopBar({ kicker, children }: { kicker: string; children?: ReactNode }) {
  const { navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const chip = "cursor-pointer rounded-[7px] border border-wd bg-topchip px-2.5 py-[7px] text-xs text-muted hover:text-text";
  return (
    <header className="flex flex-wrap items-center gap-2.5 px-[22px] py-[18px]">
      <button type="button" onClick={() => navigate(null)} className="flex cursor-pointer items-baseline gap-2.5" title="Back to libraries">
        <span translate="no" className="text-lg font-bold tracking-[-.02em] text-text">Backlog</span>
        <span className="font-mono text-[11px] text-accent">{kicker}</span>
      </button>
      {children}
      <div className="flex-1" />
      <button type="button" onClick={openSettings} title="Settings" className={chip + " flex max-w-[230px] items-center gap-[7px] font-mono text-[11px]"}>
        <GearIcon />
        <span className="truncate">{user?.email}</span>
      </button>
      <button type="button" onClick={signOut} className={chip}>
        Sign out
      </button>
    </header>
  );
}
