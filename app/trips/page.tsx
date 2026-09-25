"use client";

// Trips is private to TRIP_MEMBERS. The planner itself is ported in phase 7.
import { AuthGate } from "@/components/auth/AuthGate";
import { TopBar } from "@/components/shell/TopBar";
import { useShell } from "@/components/shell/ShellProvider";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { isTripMember } from "@/config/libraries";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/paths";

export default function TripsPage() {
  useCollectionTheme("trips");
  return (
    <AuthGate>
      <TripsBody />
    </AuthGate>
  );
}

function TripsBody() {
  const { user } = useAuth();
  const { navigate } = useShell();
  const member = isTripMember(user?.id);
  return (
    <div className="min-h-dvh">
      <TopBar kicker="// trips" />
      <main className="mx-auto max-w-[760px] px-[22px] pb-16">
        <div className="rounded-2xl border border-wf bg-surface p-6 text-sm text-muted">
          {member ? (
            <>
              The Trip Planner moves over in phase 7. Until then it lives in the{" "}
              <a href={withBase("/legacy/index.html")}>current app</a>.
            </>
          ) : (
            <>
              This page is private.{" "}
              <button type="button" className="cursor-pointer text-accent" onClick={() => navigate(null)}>
                Back to libraries
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
