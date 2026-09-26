"use client";

// Trips is private to TRIP_MEMBERS (the data is also guarded by RLS).
import { AuthGate } from "@/components/auth/AuthGate";
import { TopBar } from "@/components/shell/TopBar";
import { TripPlanner } from "@/components/trips/TripPlanner";
import { useShell } from "@/components/shell/ShellProvider";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { isTripMember } from "@/config/libraries";
import { useAuth } from "@/lib/auth";

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
  if (member) return <TripPlanner />;
  return (
    <div className="min-h-dvh">
      <TopBar kicker="// trips" />
      <main className="mx-auto max-w-[760px] px-[22px] pb-16">
        <div className="rounded-2xl border border-wf bg-surface p-6 text-sm text-muted">
          This page is private.{" "}
          <button type="button" className="cursor-pointer text-accent" onClick={() => navigate(null)}>
            Back to libraries
          </button>
        </div>
      </main>
    </div>
  );
}
