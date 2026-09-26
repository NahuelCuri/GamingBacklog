"use client";

// Development-only: a collection UI running on its starter seed in memory,
// without signing in or touching Supabase. /dev/preview/?c=books
// (?c=trips shows the Trip Planner on its example trip; ?c=home the library
// picker with sample numbers.)
import { useEffect, useState } from "react";
import { CollectionBody } from "@/components/collection/CollectionPage";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { isCollectionKey } from "@/config/collections";
import type { CollectionKey } from "@/lib/collection/types";
import { memoryStore, type CollectionStore } from "@/lib/data/store";
import { withBase } from "@/lib/paths";
import { LibraryPicker } from "@/components/home/LibraryPicker";
import { TripPlanner } from "@/components/trips/TripPlanner";
import { TRIP_MEMBERS } from "@/config/libraries";
import { PreviewAuthProvider } from "@/lib/auth";
import { rememberLast, rememberSummary } from "@/lib/home";
import { seedTrips } from "@/lib/trips/model";
import { memoryTripStore } from "@/lib/trips/store";

const IS_DEV = process.env.NODE_ENV === "development";

export default function PreviewPage() {
  const [key, setKey] = useState<CollectionKey | "trips" | "home" | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("c") || "games";
    setKey(c === "trips" || c === "home" || isCollectionKey(c) ? c : "games");
  }, []);
  if (!IS_DEV) return <p className="p-8 text-muted">Only available in development.</p>;
  if (key === "trips") return <TripsPreview />;
  if (key === "home") return <HomePreview />;
  return key ? <Preview collection={key} /> : null;
}

const PREVIEW_USER = { id: TRIP_MEMBERS[0], email: "preview@localhost" };

function HomePreview() {
  const [ready] = useState(() => {
    const u = PREVIEW_USER.id;
    rememberSummary(u, "games", { metrics: [{ value: "148", label: "games" }, { value: "6", label: "playing", accent: true }, { value: "58", label: "played" }] });
    rememberSummary(u, "books", { metrics: [{ value: "64", label: "books" }, { value: "3", label: "reading", accent: true }] });
    rememberSummary(u, "movies", { metrics: [{ value: "212", label: "titles" }, { value: "2", label: "watching", accent: true }] });
    rememberSummary(u, "expenses", { metrics: [{ value: "$1,624", label: "spent", accent: true }, { value: "$1,026", label: "saved" }], note: "September 2026" });
    rememberSummary(u, "trips", { metrics: [{ value: "2", label: "trips", accent: true }], note: "Next: Japan in 23 days" });
    if (!new URLSearchParams(location.search).has("keep")) rememberLast(u, "games");
    return true;
  });
  return ready ? (
    <PreviewAuthProvider user={PREVIEW_USER}>
      <LibraryPicker />
    </PreviewAuthProvider>
  ) : null;
}

function TripsPreview() {
  useCollectionTheme("trips");
  const [store] = useState(() => memoryTripStore(seedTrips()));
  return <TripPlanner store={store} />;
}

function Preview({ collection }: { collection: CollectionKey }) {
  useCollectionTheme(collection);
  const [store, setStore] = useState<CollectionStore | null>(null);
  useEffect(() => {
    fetch(withBase(`/seeds/${collection}.json`))
      .then((r) => r.json())
      .then((items) => setStore(memoryStore(items)));
  }, [collection]);
  return store ? <CollectionBody collection={collection} store={store} /> : null;
}
