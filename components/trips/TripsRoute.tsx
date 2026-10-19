"use client";

// /trips/: every signed-in user's own trips plus the ones shared with them
// (RLS decides which rows come back).
import { AuthGate } from "@/components/auth/AuthGate";
import { TripPlanner } from "@/components/trips/TripPlanner";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";

export function TripsRoute() {
  useCollectionTheme("trips");
  return (
    <AuthGate>
      <TripPlanner />
    </AuthGate>
  );
}
