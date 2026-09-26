"use client";

// Development-only: a collection UI running on its starter seed in memory,
// without signing in or touching Supabase. /dev/preview/?c=books
// (?c=trips shows the Trip Planner on its example trip.)
import { useEffect, useState } from "react";
import { CollectionBody } from "@/components/collection/CollectionPage";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { isCollectionKey } from "@/config/collections";
import type { CollectionKey } from "@/lib/collection/types";
import { memoryStore, type CollectionStore } from "@/lib/data/store";
import { withBase } from "@/lib/paths";
import { TripPlanner } from "@/components/trips/TripPlanner";
import { seedTrips } from "@/lib/trips/model";
import { memoryTripStore } from "@/lib/trips/store";

const IS_DEV = process.env.NODE_ENV === "development";

export default function PreviewPage() {
  const [key, setKey] = useState<CollectionKey | "trips" | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("c") || "games";
    setKey(c === "trips" || isCollectionKey(c) ? c : "games");
  }, []);
  if (!IS_DEV) return <p className="p-8 text-muted">Only available in development.</p>;
  if (key === "trips") return <TripsPreview />;
  return key ? <Preview collection={key} /> : null;
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
