"use client";

// Collection route: loads the data, owns the URL-synced view and filters, and
// hosts the header, the active tab, the add/edit form and the library switcher.
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { COLLECTIONS } from "@/config/collections";
import { blankDraft, draftFromItem } from "@/lib/collection";
import type { CollectionKey, Item } from "@/lib/collection/types";
import type { CollectionStore } from "@/lib/data/store";
import { useCollection } from "@/lib/data/useCollection";
import { useStore } from "@/lib/data/useStore";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { usd } from "@/lib/spending";
import { CollectionContext, type CollectionCtx } from "./CollectionContext";
import { CollectionHeader } from "./CollectionHeader";
import { ItemModal, type ModalState } from "./ItemModal";
import { LibraryFab } from "./LibraryFab";
import { LibraryView } from "./LibraryView";
import { RouletteView } from "./RouletteView";
import { StatsView } from "./stats/StatsView";

export function CollectionPage({ collection }: { collection: CollectionKey }) {
  useCollectionTheme(collection);
  return (
    <AuthGate>
      <CollectionBody collection={collection} />
    </AuthGate>
  );
}

const NEG = "#e6a09c";
const alertStyle: CSSProperties = { color: NEG, borderColor: "rgba(230,160,156,.25)", background: "rgba(230,160,156,.08)" };

/** The collection UI. `store` overrides the signed-in user's Supabase store (dev preview). */
export function CollectionBody({ collection, store }: { collection: CollectionKey; store?: CollectionStore | null }) {
  const cfg = COLLECTIONS[collection];
  const userStore = useStore(collection);
  const { state: data, actions } = useCollection(collection, store === undefined ? userStore : store);
  const isMobile = useIsMobile();
  const [url, setUrl] = useUrlState();
  const [modal, setModal] = useState<ModalState | null>(null);

  const openAdd = useCallback(() => setModal({ mode: "add", draft: blankDraft(cfg) }), [cfg]);
  const openEdit = useCallback((g: Item) => setModal({ mode: "edit", draft: draftFromItem(cfg, g) }), [cfg]);
  const closeModal = useCallback(() => setModal(null), []);

  const ctx = useMemo<CollectionCtx>(
    () => ({
      collection, cfg, data, items: data.items, actions, money: usd, isMobile, url, setUrl, openAdd, openEdit,
      // Share card and stats image arrive in phase 4e.
      openShare: () => {},
      openStatsImage: () => {},
    }),
    [collection, cfg, data, actions, isMobile, url, setUrl, openAdd, openEdit],
  );

  return (
    <CollectionContext.Provider value={ctx}>
      <div className="min-h-dvh" style={{ "--rowpad": "7px" } as CSSProperties}>
        <CollectionHeader />
        <main className="mx-auto max-w-[1180px]" style={{ padding: isMobile ? "0 14px 60px" : "0 26px 80px" }}>
          {data.status === "error" && (
            <div role="alert" className="mt-6 rounded-xl border px-4 py-3 text-sm" style={alertStyle}>
              Could not load your {cfg.nounPlural}: {data.loadError}{" "}
              <button type="button" className="cursor-pointer underline" onClick={() => actions?.refresh()}>
                Retry
              </button>
            </div>
          )}
          {data.syncError && (
            <div role="alert" className="mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={alertStyle}>
              <span className="flex-1">Some changes were not saved: {data.syncError}. The list shows what is stored now.</span>
              <button type="button" className="cursor-pointer underline" onClick={() => actions?.dismissSyncError()}>
                Dismiss
              </button>
            </div>
          )}
          {data.status !== "error" && url.view === "library" && <LibraryView />}
          {data.status === "ready" && url.view === "stats" && <StatsView />}
          {data.status === "ready" && url.view === "roulette" && cfg.roulette && <RouletteView />}
          {data.status !== "error" && !["library", "stats", "roulette"].includes(url.view) && (
            <p className="py-16 text-center font-mono text-[13px] text-dim">This view is being ported — coming later in phase 4.</p>
          )}
        </main>
        {modal && <ItemModal modal={modal} setModal={setModal} onClose={closeModal} />}
        <LibraryFab current={collection} />
      </div>
    </CollectionContext.Provider>
  );
}
