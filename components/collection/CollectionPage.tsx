"use client";

// Collection route shell. Phase 3 placeholder: themed header plus the data
// state from the phase 2 layer; the table, stats and roulette land in phase 4.
import { AuthGate } from "@/components/auth/AuthGate";
import { TopBar } from "@/components/shell/TopBar";
import { useCollectionTheme } from "@/components/shell/useCollectionTheme";
import { COLLECTIONS } from "@/config/collections";
import type { CollectionKey } from "@/lib/collection/types";
import { useCollection } from "@/lib/data/useCollection";
import { useStore } from "@/lib/data/useStore";

export function CollectionPage({ collection }: { collection: CollectionKey }) {
  useCollectionTheme(collection);
  return (
    <AuthGate>
      <CollectionBody collection={collection} />
    </AuthGate>
  );
}

function CollectionBody({ collection }: { collection: CollectionKey }) {
  const cfg = COLLECTIONS[collection];
  const { state, actions } = useCollection(collection, useStore(collection));

  return (
    <div className="min-h-dvh">
      <TopBar kicker={cfg.kicker} />
      <main className="mx-auto max-w-[1180px] px-[22px] pb-16">
        {state.status === "loading" && <p className="font-mono text-[13px] text-dim">loading…</p>}
        {state.status === "error" && (
          <div role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ color: "#e6a09c", borderColor: "rgba(230,160,156,.25)", background: "rgba(230,160,156,.08)" }}>
            Could not load your {cfg.nounPlural}: {state.loadError}{" "}
            <button type="button" className="cursor-pointer underline" onClick={() => actions?.refresh()}>
              Retry
            </button>
          </div>
        )}
        {state.status === "ready" && (
          <div className="rounded-2xl border border-wf bg-surface p-6">
            <div className="text-[26px] font-bold tracking-[-.02em]">{state.items.length}</div>
            <div className="text-sm text-muted">{cfg.nounPlural} loaded — the library view arrives in phase 4.</div>
          </div>
        )}
      </main>
    </div>
  );
}
