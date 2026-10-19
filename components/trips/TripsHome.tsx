"use client";

// Trips home: every trip as a card with its cover, dates, counts, companions
// and budget bar.
import { GearIcon, PencilIcon, PinIcon, PlusIcon } from "@/components/icons";
import { useShell } from "@/components/shell/ShellProvider";
import { useAuth } from "@/lib/auth";
import { budget, tripCards, tripRange } from "@/lib/trips/model";
import { useTripCtx } from "./TripPlanner";
import { Button, IconButton } from "./ui";

export function TripsHome() {
  const { data, access, openTrip, newTrip, editTrip } = useTripCtx();
  const { navigate, openSettings } = useShell();
  const { user, signOut } = useAuth();
  const n = data.trips.length;

  return (
    <div>
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-wf bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-[1080px] items-center gap-3 px-4 py-3 tp:px-7">
          <button type="button" onClick={() => navigate(null)} aria-label="All libraries" className="flex cursor-pointer items-baseline gap-2.5">
            <span translate="no" className="text-lg font-bold tracking-[-.02em] text-text">
              Backlog
            </span>
            <span aria-hidden className="font-mono text-2xs text-muted">{"// trips"}</span>
          </button>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" onClick={openSettings} aria-label="Settings and admin" title="Settings & admin" className="max-w-[200px] font-mono font-normal">
            <GearIcon size={13} />
            <span className="truncate">{user?.email}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main id="tp-main" className="mx-auto max-w-[1080px] px-4 pt-9 pb-24 tp:px-7">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-3xl font-extrabold tracking-[-.02em] text-balance text-text">Where to next?</h1>
            <div className="mt-1.5 font-mono text-xs text-muted tabular-nums">{n + (n === 1 ? " trip" : " trips")}</div>
          </div>
          <Button variant="primary" onClick={newTrip}>
            <PlusIcon size={14} />
            New trip
          </Button>
        </div>

        {n === 0 && (
          <div className="rounded-2xl border border-dashed border-wk px-6 py-11 text-center [animation:grise_320ms_var(--ease-out)_both]">
            <div className="mb-3.5 inline-flex size-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
              <PinIcon size={22} />
            </div>
            <div className="mb-1.5 text-base font-bold text-text">No trips yet</div>
            <div className="mx-auto mb-4 max-w-[380px] text-13 text-pretty text-muted">Start one to collect places, food and plans as cards, then sort them into days.</div>
            <Button variant="soft" onClick={newTrip}>
              Plan your first trip
            </Button>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-[18px]">
          {data.trips.map((t, i) => {
            // Cards rise 40ms apart; each budget bar grows once its card is in.
            const delay = Math.min(i, 12) * 40;
            const cs = tripCards(data.cards, t.id);
            const b = budget(t, cs);
            const a = access(t.id);
            const guests = a.people.filter((p) => p.role !== "owner").length;
            const shared = a.owner ? (guests ? `Shared with ${guests}` : "") : "Shared by " + (a.people.find((p) => p.role === "owner")?.email ?? "someone");
            return (
              <article key={t.id} className="relative overflow-hidden rounded-2xl border border-wf bg-card transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]" style={{ animation: `grise 320ms var(--ease-out) ${delay}ms both` }}>
                <div className="relative flex h-24 items-end gap-1.5 px-4 py-3.5" style={{ background: t.cover }}>
                  <span className="rounded-md bg-black/30 px-2 py-1 font-mono text-2xs font-semibold text-white/90 backdrop-blur-[3px]">{tripRange(t)}</span>
                  {shared && <span className="min-w-0 truncate rounded-md bg-black/30 px-2 py-1 font-mono text-2xs font-semibold text-white/90 backdrop-blur-[3px]">{shared}</span>}
                </div>
                <div className="p-4">
                  <h2 className="m-0 mb-0.5 text-lg font-bold tracking-[-.01em] text-text">
                    <button type="button" aria-label={"Open " + (t.name || "trip")} onClick={() => openTrip(t.id)} className="cursor-pointer text-left after:absolute after:inset-0 after:content-['']">
                      {t.name}
                    </button>
                  </h2>
                  <div className="mb-3.5 text-13 text-muted">{t.subtitle}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5 text-xs text-muted">
                      <span>
                        <b className="font-semibold text-text2">{cs.length}</b> cards
                      </span>
                      <span>
                        <b className="font-semibold text-text2">{cs.filter((c) => c.day != null).length}</b> planned
                      </span>
                    </div>
                    <div className="flex">
                      {(t.companions || []).map((c, i) => (
                        <div key={i} className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-card text-2xs font-bold text-[#0c0e0f]" style={{ background: c.color }}>
                          {c.initial}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded bg-chip">
                    <div className="h-full origin-left" style={{ width: b.pct, background: b.overDisp ? "var(--neg)" : "var(--accent)", animation: `ggrowx 560ms var(--ease-out) ${delay + 200}ms both` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between gap-2 font-mono text-2xs text-muted tabular-nums">
                    <span>{`${b.spentDisp} of ${b.budgetDisp}`}</span>
                    {b.overDisp && <span className="text-neg">{`${b.overDisp} over`}</span>}
                  </div>
                </div>
                <IconButton tone="onImage" aria-label={"Edit " + (t.name || "trip")} title="Edit trip" onClick={() => editTrip(t.id)} className="absolute top-2.5 right-2.5 z-[1]">
                  <PencilIcon size={13} />
                </IconButton>
              </article>
            );
          })}
          {n > 0 && (
            <button type="button" onClick={newTrip} aria-label="Plan another trip" className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-wk text-13 font-semibold text-muted transition-colors hover:border-accent hover:text-accent">
              <PlusIcon size={20} />
              Plan another trip
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
