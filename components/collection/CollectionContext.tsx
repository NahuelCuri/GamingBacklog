"use client";

import { createContext, useContext } from "react";
import type { CollectionConfig, CollectionKey, Item } from "@/lib/collection/types";
import type { UrlState } from "@/lib/collection/url-state";
import type { CollectionActions } from "@/lib/data/collection-actions";
import type { CollectionState } from "@/lib/data/collection-state";
import type { MoneyFormat } from "@/lib/spending";

export interface CollectionCtx {
  collection: CollectionKey;
  cfg: CollectionConfig;
  data: CollectionState;
  items: Item[];
  actions: CollectionActions | null;
  money: MoneyFormat;
  isMobile: boolean;
  url: UrlState;
  setUrl(patch: Partial<UrlState> | ((s: UrlState) => Partial<UrlState>)): void;
  openAdd(): void;
  openEdit(item: Item): void;
  openShare(item: Item): void;
  openStatsImage(): void;
}

export const CollectionContext = createContext<CollectionCtx | null>(null);

export function useCollectionCtx(): CollectionCtx {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollectionCtx must be used inside a collection page");
  return ctx;
}
