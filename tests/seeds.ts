// The starter seeds the app ships (public/seeds), for tests that need real data.
import fs from "node:fs";
import path from "node:path";
import type { CollectionKey, Item } from "@/lib/collection/types";

export const KEYS: CollectionKey[] = ["games", "books", "wines", "movies", "expenses"];

export function seed(key: CollectionKey): Item[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "seeds", `${key}.json`), "utf8"));
}
