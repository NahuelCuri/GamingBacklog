import type { Metadata } from "next";
import { TripsRoute } from "@/components/trips/TripsRoute";

export const metadata: Metadata = { title: "Trips · Backlog" };

export default function TripsPage() {
  return <TripsRoute />;
}
