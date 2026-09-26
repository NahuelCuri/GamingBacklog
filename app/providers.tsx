"use client";

import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { ShellProvider } from "@/components/shell/ShellProvider";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ShellProvider>{children}</ShellProvider>
      <LanguageToggle />
    </AuthProvider>
  );
}
