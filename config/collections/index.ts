import type { CollectionConfig, CollectionKey } from "@/lib/collection/types";
import { books } from "./books";
import { expenses } from "./expenses";
import { games } from "./games";
import { movies } from "./movies";
import { wines } from "./wines";

export const COLLECTIONS: Record<CollectionKey, CollectionConfig> = { games, books, wines, movies, expenses };

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];

export function isCollectionKey(k: string): k is CollectionKey {
  return k in COLLECTIONS;
}
