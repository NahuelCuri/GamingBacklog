"use client";

import { useEffect } from "react";
import type { LibraryKey } from "@/config/libraries";

/** Applies a library's palette (see globals.css) while the calling page is mounted. */
export function useCollectionTheme(key: LibraryKey) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.collection = key;
    return () => {
      if (root.dataset.collection === key) delete root.dataset.collection;
    };
  }, [key]);
}
