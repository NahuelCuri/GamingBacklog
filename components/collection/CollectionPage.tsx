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
import { useCurrency } from "@/lib/hooks/useCurrency";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { hasView } from "@/lib/collection/url-state";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { CollectionContext, type CollectionCtx } from "./CollectionContext";
import { CollectionHeader } from "./CollectionHeader";
import { GeoMapView } from "./GeoMapView";
import { ItemModal, type ModalState } from "./ItemModal";
import { LibraryFab } from "./LibraryFab";
import { LibraryView } from "./LibraryView";
import { MonthsView } from "./MonthsView";
import { RouletteView } from "./RouletteView";
import { ShareCardDialog } from "./share/ShareCardDialog";
import { ShareImageDialog } from "./share/ShareImageDialog";
import { StatsView } from "./stats/StatsView";

export function CollectionPage({ collection }: { collection: CollectionKey }) {
  useCollectionTheme(collection);
  return (
    <AuthGate>
      <CollectionBody collection={collection} />
    </AuthGate>
  );
}

const alertClass = "mt-6 rounded-xl border border-neg/25 bg-neg/8 px-4 py-3 text-sm text-neg";

/** The collection UI. `store` overrides the signed-in user's Supabase store (dev preview). */
export function CollectionBody({ collection, store }: { collection: CollectionKey; store?: CollectionStore | null }) {
  const cfg = COLLECTIONS[collection];
  const userStore = useStore(collection);
  const { state: data, actions } = useCollection(collection, store === undefined ? userStore : store);
  const isMobile = useIsMobile();
  const { money, toggle: currency } = useCurrency(cfg.currency);
  const [rawUrl, setUrl] = useUrlState();
  const url = useMemo(() => (hasView(cfg, rawUrl.view) ? rawUrl : { ...rawUrl, view: "library" as const }), [cfg, rawUrl]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [shareItem, setShareItem] = useState<Item | null>(null);
  const [statsImage, setStatsImage] = useState(false);

  const openAdd = useCallback(() => setModal({ mode: "add", draft: blankDraft(cfg) }), [cfg]);
  const openEdit = useCallback((g: Item) => setModal({ mode: "edit", draft: draftFromItem(cfg, g) }), [cfg]);
  const closeModal = useCallback(() => setModal(null), []);

  const ctx = useMemo<CollectionCtx>(
    () => ({
      collection, cfg, data, items: data.items, actions, money, currency, isMobile, url, setUrl, openAdd, openEdit,
      openShare: setShareItem,
      openStatsImage: () => setStatsImage(true),
    }),
    [collection, cfg, data, actions, money, currency, isMobile, url, setUrl, openAdd, openEdit],
  );

  return (
    <CollectionContext.Provider value={ctx}>
      <div className="min-h-dvh" style={{ "--rowpad": "7px" } as CSSProperties}>
        <CollectionHeader />
        <main className="mx-auto max-w-[1180px]" style={{ padding: isMobile ? "0 14px 60px" : "0 26px 80px" }}>
          {data.status === "error" && (
            <div role="alert" className={alertClass}>
              Could not load your {cfg.nounPlural}: {data.loadError}{" "}
              <button type="button" className="cursor-pointer underline" onClick={() => actions?.refresh()}>
                Retry
              </button>
            </div>
          )}
          {data.syncError && (
            <div role="alert" className={alertClass + " flex items-center gap-3"}>
              <span className="flex-1">Some changes were not saved: {data.syncError}. The list shows what is stored now.</span>
              <button type="button" className="cursor-pointer underline" onClick={() => actions?.dismissSyncError()}>
                Dismiss
              </button>
            </div>
          )}
          {data.status !== "error" && url.view === "library" && <LibraryView />}
          {data.status === "ready" && url.view === "stats" && <StatsView />}
          {data.status === "ready" && url.view === "months" && <MonthsView />}
          {data.status === "ready" && url.view === "roulette" && <RouletteView />}
          {data.status === "ready" && url.view === "map" && <GeoMapView />}
        </main>
        {modal && <ItemModal modal={modal} setModal={setModal} onClose={closeModal} />}
        {statsImage && <ShareImageDialog onClose={() => setStatsImage(false)} />}
        {shareItem && <ShareCardDialog item={shareItem} onClose={() => setShareItem(null)} />}
        <LibraryFab current={collection} />
      </div>
    </CollectionContext.Provider>
  );
}
