// The libraries on the home picker (Backlog.dc.html LIB_DEFS / PALETTES) and
// who may see the private ones. Access to data is enforced server-side by RLS;
// these lists only decide what the UI shows.

export type LibraryKey = "games" | "books" | "wines" | "movies" | "expenses" | "trips";

export interface LibraryDef {
  key: LibraryKey;
  label: string;
  desc: string;
  color: string;
}

export const LIBRARIES: LibraryDef[] = [
  { key: "games", label: "Games", desc: "Backlog, stats & roulette", color: "#9ce6b0" },
  { key: "books", label: "Books", desc: "Reading list, stats & roulette", color: "#d8b98f" },
  { key: "wines", label: "Wines", desc: "Cellar & tasting notes", color: "#c6a9d6" },
  { key: "movies", label: "Movies", desc: "Watchlist, stats & roulette", color: "#a9aee0" },
  { key: "expenses", label: "Expenses", desc: "Transactions, months & stats", color: "#8ecfd6" },
  { key: "trips", label: "Trips", desc: "Research & itinerary planning", color: "#5fb8b0" },
];

export const LIBRARY_KEYS = LIBRARIES.map((d) => d.key);

export const ADMIN_UID = "8ca752c7-962b-4bcf-98a6-392d168b6481";

/** Trips is private to these accounts (data guarded by RLS via trip_members). */
export const TRIP_MEMBERS = [
  "8ca752c7-962b-4bcf-98a6-392d168b6481", // admin account
  "7576f6af-09b6-4c22-8357-2e42dd418b94", // brother
];

export const isAdmin = (uid: string | null | undefined) => uid === ADMIN_UID;
export const isTripMember = (uid: string | null | undefined) => !!uid && TRIP_MEMBERS.includes(uid);
