"use client";

// Trip Planner (members only): a home with every trip, and a board per trip with
// Cards / Itinerary / Map tabs, card and trip editors, compare mode and a
// currency converter. Ported from legacy-src/Trip Planner.dc.html.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LibraryFab } from "@/components/collection/LibraryFab";
import { TRIPS_MOBILE_QUERY, useIsMobile } from "@/lib/hooks/useIsMobile";
import {
  blankCard, blankTrip, cleanCard, cleanTrip, moveCardDay, moveCardOrder, tripCards,
  type CardDraft, type Trip, type TripCard, type TripData,
} from "@/lib/trips/model";
import type { TripStore } from "@/lib/trips/store";
import { useTripStore, useTrips, type TripsState } from "@/lib/trips/useTrips";
import { CompareButton, CompareDrawer, type CompareState, openInCompare } from "./CompareDrawer";
import { CardEditorDialog, CardViewDialog, DeleteTripDialog, TripEditorDialog } from "./dialogs";
import { T } from "./styles";
import { TripBoard } from "./TripBoard";
import { TripsHome } from "./TripsHome";

export type BoardTab = "cards" | "itinerary" | "map";

interface Nav {
  view: "home" | "board";
  tripId: string | null;
  boardTab: BoardTab;
  viewCard: string | null;
}

const HOME: Nav = { view: "home", tripId: null, boardTab: "cards", viewCard: null };

function readNav(search: string): Nav {
  const p = new URLSearchParams(search);
  const nav = { ...HOME };
  const trip = p.get("trip");
  if (trip) Object.assign(nav, { view: "board", tripId: trip });
  const tab = p.get("tab") as BoardTab | null;
  if (tab && ["cards", "itinerary", "map"].includes(tab)) nav.boardTab = tab;
  nav.viewCard = p.get("card");
  return nav;
}

function navUrl(n: Nav): string {
  const p = new URLSearchParams(location.search);
  ["trip", "tab", "card"].forEach((k) => p.delete(k));
  if (n.view === "board" && n.tripId) {
    p.set("trip", n.tripId);
    p.set("tab", n.boardTab);
  }
  if (n.viewCard) p.set("card", n.viewCard);
  const q = p.toString();
  return location.pathname + (q ? "?" + q : "") + location.hash;
}

/** Trip, tab and open card live in the query string (every change is a history entry, as in legacy). */
function useNav() {
  const [nav, setNavState] = useState<Nav>(HOME);
  // The latest nav, so back-to-back setNav calls compose without reading it inside an updater.
  const current = useRef<Nav>(HOME);
  useEffect(() => {
    const sync = () => {
      current.current = readNav(location.search);
      setNavState(current.current);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  // Push outside the state updater: Next's router listens to pushState, and updating
  // it from inside another component's updater is a setState-during-render.
  const setNav = useCallback((patch: Partial<Nav>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    const url = navUrl(next);
    if (url !== location.pathname + location.search + location.hash) history.pushState({ tp: 1 }, "", url);
    setNavState(next);
  }, []);
  return [nav, setNav] as const;
}

export type CardModal = CardDraft & { __new?: boolean };
export type TripModal = Trip & { __new?: boolean };

export interface TripCtx {
  data: TripsState;
  isMobile: boolean;
  trip: Trip | null;
  /** Cards of the open trip, in stored order. */
  cards: TripCard[];
  nav: Nav;
  setTab(t: BoardTab): void;
  persist(patch: Partial<TripData>): Promise<void>;
  openTrip(id: string): void;
  goHome(): void;
  openCard(id: string): void;
  openEdit(id: string): void;
  newCard(): void;
  newTrip(): void;
  editTrip(id: string): void;
  moveDay(id: string, dir: number): void;
  moveOrder(id: string, dir: number): void;
  announce(msg: string): void;
  poolFilter: string;
  setPoolFilter(v: string): void;
  compare: CompareState;
  setCompare(fn: (c: CompareState) => CompareState): void;
}

const Ctx = createContext<TripCtx | null>(null);

export function useTripCtx(): TripCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTripCtx must be used inside TripPlanner");
  return c;
}

const refocusCard = (id: string) =>
  setTimeout(() => document.querySelector<HTMLElement>(`[data-flip="${id.replace(/["\\]/g, "\\$&")}"]`)?.focus(), 30);

/** `store` overrides the signed-in member's Supabase store (dev preview, tests). */
export function TripPlanner({ store: override }: { store?: TripStore | null }) {
  const userStore = useTripStore();
  const store = override === undefined ? userStore : override;
  const { state: data, persist, retry, dismissSyncError } = useTrips(store);
  const isMobile = useIsMobile(TRIPS_MOBILE_QUERY);
  const [nav, setNav] = useNav();
  const [modal, setModal] = useState<CardModal | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [tripModal, setTripModal] = useState<TripModal | null>(null);
  const [delTrip, setDelTrip] = useState<{ id: string; name: string } | null>(null);
  const [undo, setUndo] = useState<{ id: number; label: string; cards: TripCard[] } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [liveMsg, setLiveMsg] = useState("");
  const [poolFilter, setPoolFilter] = useState("all");
  const [compare, setCompare] = useState<CompareState>({ on: false, open: [], min: false, h: null, zoom: 1 });

  const trip = (nav.view === "board" && data.trips.find((t) => t.id === nav.tripId)) || null;
  const cards = useMemo(() => tripCards(data.cards, trip?.id ?? null), [data.cards, trip?.id]);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const openEdit = useCallback((id: string) => {
    const c = dataRef.current.cards.find((x) => x.id === id);
    if (!c) return;
    setConfirmDel(false);
    setModal({ ...c, tags: [...(c.tags || [])], tagInput: "", price: (c.price == null ? "" : String(c.price)) as never });
  }, []);

  const ctx = useMemo<TripCtx>(
    () => ({
      data, isMobile, trip, cards, nav, persist, poolFilter, setPoolFilter, compare,
      setCompare: (fn) => setCompare(fn),
      setTab: (boardTab) => setNav({ boardTab }),
      openTrip: (id) => {
        setPoolFilter("all");
        setCompare((c) => ({ ...c, open: [] }));
        setNav({ view: "board", tripId: id, boardTab: "cards" });
      },
      goHome: () => {
        setCompare((c) => ({ ...c, open: [] }));
        setNav({ view: "home", tripId: null });
      },
      openCard: (id) => (compare.on ? setCompare((c) => openInCompare(c, id)) : setNav({ viewCard: id })),
      openEdit,
      newCard: () => {
        if (!trip) return;
        setConfirmDel(false);
        setModal({ ...blankCard(trip.id), price: "" as never, tagInput: "", __new: true });
      },
      newTrip: () => setTripModal({ ...blankTrip(), budget: "" as never, __new: true }),
      editTrip: (id) => {
        const t = data.trips.find((x) => x.id === id);
        if (t) setTripModal({ ...t, budget: (t.budget == null ? "" : String(t.budget)) as never, __new: false });
      },
      moveDay: (id, dir) => {
        const r = moveCardDay(data.cards, id, dir, trip?.dayCount || 0);
        if (!r) return;
        void persist({ cards: r.cards });
        setLiveMsg(r.message);
        refocusCard(id);
      },
      moveOrder: (id, dir) => {
        const r = moveCardOrder(data.cards, id, dir);
        if (!r) return;
        void persist({ cards: r.cards });
        setLiveMsg(r.message);
        refocusCard(id);
      },
      announce: setLiveMsg,
    }),
    [data, isMobile, trip, cards, nav, persist, poolFilter, compare, setNav, openEdit],
  );

  const saveCard = (m: CardModal) => {
    const { __new, ...draft } = m;
    const clean = cleanCard(draft);
    void persist({ cards: __new ? [...data.cards, clean] : data.cards.map((c) => (c.id === clean.id ? clean : c)) });
    setModal(null);
  };

  const deleteCard = (m: CardModal) => {
    if (!confirmDel) return setConfirmDel(true);
    const before = data.cards;
    void persist({ cards: before.filter((c) => c.id !== m.id) });
    setModal(null);
    setConfirmDel(false);
    clearTimeout(undoTimer.current);
    setUndo({ id: Date.now(), label: (m.title || "Card") + " deleted", cards: before });
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
  };

  const saveTrip = (d: TripModal) => {
    const { __new, ...rest } = d;
    const clean = cleanTrip(rest);
    if (__new) {
      void persist({ trips: [...data.trips, clean] });
      ctx.openTrip(clean.id);
    } else void persist({ trips: data.trips.map((x) => (x.id === clean.id ? clean : x)) });
    setTripModal(null);
  };

  const confirmDeleteTrip = (id: string) => {
    void persist({ trips: data.trips.filter((x) => x.id !== id), cards: data.cards.filter((c) => c.trip !== id) });
    setDelTrip(null);
    setTripModal(null);
    ctx.goHome();
  };

  const viewed = nav.viewCard ? data.cards.find((c) => c.id === nav.viewCard) : undefined;

  let body: ReactNode;
  if (data.status === "loading") body = <Centered>loading…</Centered>;
  else if (data.status === "error")
    body = (
      <Centered>
        <span role="alert">
          Could not load your trips: {data.loadError}.{" "}
          <button type="button" onClick={retry} style={{ color: T.accent, background: "none", border: "none", cursor: "pointer", font: "inherit" }}>
            Retry
          </button>
        </span>
      </Centered>
    );
  else body = trip ? <TripBoard /> : <TripsHome />;

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ minHeight: "100dvh", background: T.bg, color: T.text }}>
        <a href="#tp-main" className="tp-skip">
          Skip to content
        </a>
        {data.syncError && (
          <div role="alert" style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 450, display: "flex", gap: 12, alignItems: "center", background: "#2a1c1c", border: "1px solid #3a2828", color: "#f0c4c4", borderRadius: 10, padding: "9px 14px", fontSize: 13 }}>
            <span>Some changes were not saved: {data.syncError}. Showing what is stored now.</span>
            <button type="button" onClick={dismissSyncError} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
              Dismiss
            </button>
          </div>
        )}
        {body}

        {viewed && <CardViewDialog card={viewed} onClose={() => setNav({ viewCard: null })} onEdit={() => { setNav({ viewCard: null }); openEdit(viewed.id); }} />}
        {modal && (
          <CardEditorDialog
            modal={modal}
            setModal={setModal}
            confirmDel={confirmDel}
            onSave={saveCard}
            onDelete={deleteCard}
            onClose={() => {
              setModal(null);
              setConfirmDel(false);
            }}
          />
        )}
        {tripModal && (
          <TripEditorDialog
            modal={tripModal}
            setModal={setTripModal}
            onSave={saveTrip}
            onClose={() => setTripModal(null)}
            onDelete={() => setDelTrip({ id: tripModal.id, name: tripModal.name || "Untitled trip" })}
          />
        )}
        {delTrip && <DeleteTripDialog name={delTrip.name} onCancel={() => setDelTrip(null)} onConfirm={() => confirmDeleteTrip(delTrip.id)} />}

        <div aria-live="polite" className="sr-only">
          {liveMsg}
        </div>

        {undo && (
          <div key={undo.id} role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", overflow: "hidden", animation: "gtoast 260ms var(--ease-out) both", bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", zIndex: 400, display: "flex", alignItems: "center", gap: 14, background: "#171b1d", border: `1px solid ${T.border2}`, borderRadius: 12, padding: "11px 14px", boxShadow: "0 14px 40px rgba(0,0,0,.55)" }}>
            <span aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: T.accent, opacity: 0.55, transformOrigin: "left", animation: "gdrain 8s linear both" }} />
            <span style={{ fontSize: 13, color: T.text2 }}>{undo.label}</span>
            <button
              type="button"
              onClick={() => {
                clearTimeout(undoTimer.current);
                void persist({ cards: undo.cards });
                setUndo(null);
              }}
              style={{ font: "inherit", fontSize: 12.5, fontWeight: 700, color: T.onAccent, background: T.accent, border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}
            >
              Undo
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                clearTimeout(undoTimer.current);
                setUndo(null);
              }}
              style={{ font: "inherit", background: "none", border: "none", color: T.dim, fontSize: 15, lineHeight: 1, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {trip && nav.boardTab === "cards" && !compare.on && <CompareButton onClick={() => setCompare((c) => ({ ...c, on: true, min: false }))} />}
        {compare.on && <CompareDrawer />}
        {!compare.on && <LibraryFab current="trips" />}
      </div>
    </Ctx.Provider>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 12, color: T.dim2, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}

