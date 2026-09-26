// Trip Planner data model and pure logic, ported from legacy-src/Trip Planner.dc.html.
// Trips and cards are stored as-is in the shared `trips` / `trip_cards` tables
// (row.data), so the shapes below must stay compatible with legacy.

export interface Companion {
  initial: string;
  color: string;
}

export interface Trip {
  id: string;
  name: string;
  subtitle?: string;
  start?: string;
  end?: string;
  dayCount?: number;
  budget?: number | null;
  currency?: string;
  cover?: string;
  companions?: Companion[];
  [k: string]: unknown;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripCard {
  id: string;
  trip: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  tags?: string[];
  price?: number | null;
  region?: string;
  notes?: string;
  source?: string;
  startTime?: string;
  duration?: string;
  day?: number | null;
  addedBy?: string;
  loc?: LatLng | null;
  /** Position in the stored list (see withOrder). */
  order?: number;
  [k: string]: unknown;
}

export interface TripData {
  trips: Trip[];
  cards: TripCard[];
}

export const TRIP_ACCENT = "#5fb8b0";

export const TYPES = [
  { value: "place", label: "Place", color: "#6cc6c0" },
  { value: "food", label: "Food", color: "#e0a86b" },
  { value: "activity", label: "Activity", color: "#9ce6b0" },
  { value: "lodging", label: "Lodging", color: "#c6a9d6" },
  { value: "transport", label: "Transport", color: "#8ec5e6" },
  { value: "watch", label: "To watch", color: "#e69bb0" },
  { value: "research", label: "Look into", color: "#9aa7b5" },
  { value: "todo", label: "To-do", color: "#d8d06a" },
  { value: "important", label: "Important", color: "#e0a86b" },
] as const;

export const STATUSES = [
  { value: "idea", label: "Idea", dot: "transparent", glow: "inset 0 0 0 1.5px #4a514c", text: "#8b938d" },
  { value: "researched", label: "Researched", dot: "#7a8fb0", glow: "none", text: "#9fb0c8" },
  { value: "confirmed", label: "Confirmed", dot: "#5fb8b0", glow: "0 0 7px rgba(95,184,176,.6)", text: "#5fb8b0" },
  { value: "booked", label: "Booked", dot: "#7fd39a", glow: "0 0 7px rgba(127,211,154,.55)", text: "#7fd39a" },
] as const;

export const PRIOS = [
  { value: "must", label: "Must-do" },
  { value: "nice", label: "Nice" },
  { value: "backup", label: "Backup" },
] as const;

export const typeMeta = (v: unknown) => TYPES.find((t) => t.value === v) || TYPES[0];
export const statusMeta = (v: unknown) => STATUSES.find((s) => s.value === v) || STATUSES[0];
export const prioMeta = (v: unknown) => PRIOS.find((p) => p.value === v);
/** Status dot for chips: "Idea" has none, so show the ring color. */
export const statusDotColor = (v: unknown) => {
  const s = STATUSES.find((x) => x.value === v);
  return !s || s.dot === "transparent" ? "#4a514c" : s.dot;
};

export function money(n: unknown, cur?: string): string {
  if (n == null || n === "") return "";
  const c = cur || "$";
  return c === "$" ? "$" + Number(n).toLocaleString() : c + " " + Number(n).toLocaleString();
}

export function fmtRange(a: string, b: string): string {
  const A = new Date(a + "T00:00"), B = new Date(b + "T00:00");
  if (isNaN(+A) || isNaN(+B)) return "Dates TBD";
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return A.toLocaleDateString(undefined, o) + " – " + B.toLocaleDateString(undefined, o);
}

export const tripRange = (t: Trip) => (t.start && t.end ? fmtRange(t.start, t.end) : "Dates TBD");

/** "Sat, Apr 4" for day `d` of a trip that has a start date. */
export function dayHint(t: Trip, d: number): string {
  if (!t.start) return "unscheduled";
  const base = new Date(t.start + "T00:00");
  if (isNaN(+base)) return "unscheduled";
  const dt = new Date(base.getTime() + (d - 1) * 86400000);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const tripCards = (cards: TripCard[], tripId: string | null) => cards.filter((c) => c.trip === tripId);

/** Spent vs budget for a trip's cards. */
export function budget(t: Trip, cards: TripCard[]) {
  const spent = cards.reduce((a, c) => a + (Number(c.price) || 0), 0);
  const raw = t.budget ? (spent / Number(t.budget)) * 100 : 0;
  return {
    spent,
    pct: Math.min(100, raw) + "%",
    color: raw > 100 ? "#d98a8a" : TRIP_ACCENT,
    spentDisp: money(spent, t.currency),
    budgetDisp: money(t.budget, t.currency),
  };
}

// ---------------------------------------------------------------- seed

/** The example trip legacy writes to an empty shared space (fixed ids, so two first loads dedupe). */
export function seedTrips(): TripData {
  const trips: Trip[] = [
    {
      id: "t1", name: "Japan · Cherry Season", subtitle: "Tokyo → Kyoto → Osaka",
      start: "2026-04-03", end: "2026-04-14", dayCount: 4,
      budget: 4200, currency: "$",
      cover: "linear-gradient(120deg,#c76b7e,#6b4b8a)",
      companions: [{ initial: "M", color: "#e0a86b" }, { initial: "L", color: "#6cc6c0" }],
    },
  ];
  const c = (o: Partial<TripCard>): TripCard =>
    Object.assign(
      { trip: "t1", tags: [], status: "idea", price: null, region: "", notes: "", source: "", startTime: "", duration: "", priority: "nice", day: null, addedBy: "Me" },
      o,
    ) as TripCard;
  const cards = [
    c({ id: "c1", title: "teamLab Planets", type: "activity", status: "confirmed", price: 3800, region: "Toyosu, Tokyo", startTime: "09:30", duration: "2h", priority: "must", day: 1, tags: ["book ahead"], source: "https://example.com" }),
    c({ id: "c2", title: "Ichiran Ramen — Shibuya", type: "food", status: "researched", price: 1200, region: "Shibuya, Tokyo", startTime: "12:30", duration: "1h", priority: "nice", day: 1, tags: ["solo booths"] }),
    c({ id: "c3", title: "Shinjuku Gyoen — sakura", type: "place", status: "confirmed", price: 500, region: "Shinjuku, Tokyo", startTime: "09:00", duration: "half day", priority: "must", day: 2, tags: ["picnic"] }),
    c({ id: "c4", title: "Golden Gai bar crawl", type: "activity", status: "idea", region: "Shinjuku, Tokyo", duration: "evening", priority: "nice", day: 2 }),
    c({ id: "c5", title: "Shinkansen to Kyoto", type: "transport", status: "booked", price: 13320, region: "Tokyo → Kyoto", duration: "2h15", priority: "must", day: 3, tags: ["reserved seat"] }),
    c({ id: "c6", title: "Fushimi Inari at dawn", type: "place", status: "confirmed", region: "Fushimi, Kyoto", duration: "3h", priority: "must", day: 3, tags: ["go early"] }),
    c({ id: "c7", title: "Nishiki Market crawl", type: "food", status: "idea", region: "Nakagyo, Kyoto", duration: "2h", priority: "nice" }),
    c({ id: "c8", title: "Arashiyama bamboo grove", type: "place", status: "researched", region: "Arashiyama, Kyoto", duration: "half day", priority: "nice" }),
    c({ id: "c9", title: "Osaka Dotonbori street food", type: "food", status: "idea", region: "Namba, Osaka", priority: "must", tags: ["takoyaki"] }),
    c({ id: "c10", title: "Watch: Kyoto in 4 min", type: "watch", status: "idea", source: "https://youtube.com", priority: "backup", notes: "Sent by Lu — scout temples" }),
    c({ id: "c11", title: "Pocket wifi vs eSIM?", type: "research", status: "idea", priority: "nice", notes: "Compare Ubigi eSIM vs airport wifi rental" }),
    c({ id: "c12", title: "Buy JR Pass before flying", type: "todo", status: "idea", priority: "must" }),
  ];
  return { trips, cards };
}

// ---------------------------------------------------------------- editing

export const newId = (prefix: "t" | "c", now = Date.now()) => prefix + now;

export function blankTrip(now = Date.now()): Trip {
  return {
    id: newId("t", now), name: "", subtitle: "", start: "", end: "", dayCount: 3, budget: null, currency: "$",
    cover: "linear-gradient(120deg,#3a6b66,#274a6b)", companions: [{ initial: "M", color: TRIP_ACCENT }],
  };
}

export function blankCard(tripId: string, now = Date.now()): TripCard {
  return {
    id: newId("c", now), trip: tripId, title: "", type: "place", status: "idea", tags: [], price: null, region: "", notes: "",
    source: "", startTime: "", duration: "", priority: "nice", day: null, addedBy: "Me",
  };
}

/** Trip editor draft (budget as text) → stored trip. */
export function cleanTrip(d: Trip): Trip {
  const b = d.budget as unknown;
  return {
    ...d,
    name: String(d.name || "").trim() || "Untitled trip",
    budget: b === "" || b == null ? 0 : Number(b),
    dayCount: Number(d.dayCount) || 1,
  };
}

/** A card being edited: price is text, plus the location field's transient state. */
export type CardDraft = TripCard & LocDraft & { tagInput?: string };

/**
 * Card editor draft (price and location as text) → stored card. Legacy set
 * `loc` from the location text even when the field was never touched, which
 * erased a card's coordinates on every edit; now it only changes when edited.
 */
export function cleanCard(d: CardDraft): TripCard {
  const { locText, locBusy: _b, locErr: _e, locFound: _f, tagInput: _t, ...core } = d;
  return {
    ...core,
    ...(locText != null ? { loc: parseLoc(locText) } : {}),
    tags: (d.tags || []).map((s) => String(s).trim()).filter(Boolean),
    price: (d.price as unknown) === "" || d.price == null ? null : Number(d.price),
  };
}

/** Quick add: a URL becomes an untitled "Look into" card with the link as its source. */
export function quickAddCard(raw: string, tripId: string, now = Date.now()): TripCard | null {
  const text = raw.trim();
  if (!text) return null;
  const isUrl = /^https?:\/\//i.test(text);
  return {
    id: newId("c", now), trip: tripId, title: isUrl ? "Untitled link" : text, type: isUrl ? "research" : "place", status: "idea",
    tags: [], price: null, region: "", notes: "", source: isUrl ? text : "", duration: "", priority: "nice", day: null, addedBy: "Me",
  };
}

export function addTag(tags: string[] | undefined, raw: string): string[] {
  const t = raw.trim();
  const cur = tags || [];
  return !t || cur.includes(t) ? cur : [...cur, t];
}

/** Most-used tags across all cards, minus the draft's, filtered by what is typed. */
export function tagSuggestions(cards: TripCard[], used: string[], typed: string): string[] {
  const q = typed.trim().toLowerCase();
  const counts: Record<string, number> = {};
  cards.forEach((c) => (c.tags || []).forEach((v) => (counts[v] = (counts[v] || 0) + 1)));
  return Object.keys(counts)
    .filter((t) => !used.includes(t) && (!q || t.toLowerCase().includes(q)))
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 8);
}

// ---------------------------------------------------------------- scheduling

/**
 * Card order (within a day, and in the pool) is the list order. Legacy never
 * saved it: rows come back from the table in no particular order, so a reorder
 * was lost on reload. Each card now carries its index; only moved cards change.
 */
export const withOrder = (cards: TripCard[]) => cards.map((c, i) => (c.order === i ? c : { ...c, order: i }));

/** Stored order first; cards without one (added by legacy) keep their relative place after. */
export function byOrder(cards: TripCard[]): TripCard[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.order ?? Infinity) - (b.c.order ?? Infinity) || a.i - b.i)
    .map((x) => x.c);
}

/** Move a card one day left/right (day 0 = the pool). Null when it can't move. */
export function moveCardDay(cards: TripCard[], id: string, dir: number, dayCount: number) {
  const c = cards.find((x) => x.id === id);
  if (!c) return null;
  const next = (c.day == null ? 0 : c.day) + dir;
  if (next < 0 || next > dayCount) return null;
  return {
    cards: cards.map((x) => (x.id === id ? { ...x, day: next === 0 ? null : next } : x)),
    message: (c.title || "Card") + " moved to " + (next === 0 ? "the pool" : "day " + next),
  };
}

/** Swap a card with its previous/next sibling in the same day of the same trip. */
export function moveCardOrder(cards: TripCard[], id: string, dir: number) {
  const list = [...cards];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const day = list[i].day == null ? null : list[i].day;
  const sibs = list.map((c, idx) => ({ c, idx })).filter((o) => (o.c.day == null ? null : o.c.day) === day && o.c.trip === list[i].trip);
  const at = sibs.findIndex((o) => o.idx === i);
  const target = sibs[at + dir];
  if (!target) return null;
  const [moved] = list.splice(i, 1);
  list.splice(target.idx, 0, moved);
  return { cards: list, message: (moved.title || "Card") + " moved " + (dir < 0 ? "earlier" : "later") };
}

export const setCardDay = (cards: TripCard[], id: string, day: number | null) => cards.map((c) => (c.id === id ? { ...c, day } : c));

/** Keyboard help read out for a card on the itinerary board. */
export const cardAriaLabel = (c: TripCard) =>
  (c.title || "Card") + (c.day != null ? " — day " + c.day : " — in the pool") + ". Enter opens it; left and right arrows change day; up and down reorder.";

// ---------------------------------------------------------------- filters

export const matchesType = (c: TripCard, filter: string) => filter === "all" || c.type === filter;

export function matchesSearch(c: TripCard, text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return true;
  return (
    (c.title || "").toLowerCase().includes(q) ||
    (c.region || "").toLowerCase().includes(q) ||
    (c.tags || []).join(" ").toLowerCase().includes(q) ||
    (c.notes || "").toLowerCase().includes(q)
  );
}

/** "All" plus the types present in `cards`, in TYPES order. */
export function typeFilterOptions(cards: TripCard[]) {
  const present = new Set(cards.map((c) => c.type));
  return [{ value: "all", label: "All", color: undefined as string | undefined }, ...TYPES.filter((t) => present.has(t.value)).map((t) => ({ value: t.value, label: t.label, color: t.color as string | undefined }))];
}

// ---------------------------------------------------------------- location

/** Coordinates from a Google Maps URL, "lat, lng" text or a {lat,lng} object. */
export function parseLoc(raw: unknown): LatLng | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    const o = raw as { lat: unknown; lng: unknown };
    return isFinite(o.lat as number) && isFinite(o.lng as number) ? { lat: +(o.lat as number), lng: +(o.lng as number) } : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const mk = (a: string, b: string) => {
    const lat = +a, lng = +b;
    return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };
  let m: RegExpMatchArray | null;
  if ((m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) return mk(m[1], m[2]);
  if ((m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/))) return mk(m[1], m[2]);
  if ((m = s.match(/[?&](?:q|query|ll|sll|center|destination|daddr)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i))) return mk(m[1], m[2]);
  if ((m = s.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*\)?$/))) return mk(m[1], m[2]);
  if ((m = s.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/))) return mk(m[1], m[2]);
  return null;
}

export const locStr = (loc: LatLng | null | undefined) => (loc ? loc.lat.toFixed(5) + ", " + loc.lng.toFixed(5) : "");

/** What to search for when the location text has no coordinates, or null. */
export function locQuery(raw: string, title?: string, region?: string): string | null {
  let q = raw;
  const nice = raw.match(/\/place\/([^/@?]+)/);
  if (nice) q = decodeURIComponent(nice[1]).replace(/\+/g, " ");
  else if (/^https?:\/\//i.test(raw)) q = "";
  if (!q && title) q = [title, region].filter(Boolean).join(", ");
  return q || null;
}

export interface LocDraft {
  loc?: LatLng | null;
  locText?: string | null;
  locBusy?: boolean;
  locErr?: "none" | "noquery" | null;
  locFound?: string | null;
}

/** Hint, colour and help text under the Location field. */
export function locStatus(md: LocDraft) {
  const raw = String(md.locText != null ? md.locText : locStr(md.loc)).trim();
  const parsed = parseLoc(raw);
  const isUrl = /^https?:\/\//i.test(raw);
  const isShort = /goo\.gl|maps\.app/i.test(raw);
  let hint = "optional", color = "#5f6b68";
  if (md.locBusy) { hint = "searching…"; color = "#8a9693"; }
  else if (parsed) { hint = "✓ on the map"; color = TRIP_ACCENT; }
  else if (raw) { hint = "no coordinates yet"; color = "#d98a6a"; }
  let note = "Right-click the spot in Google Maps — the first menu item is the lat/lng. Click it to copy, then paste here.";
  if (md.locErr === "none") note = "Nothing found for that. Try a more specific name, or paste coordinates.";
  else if (md.locErr === "noquery") note = "That short link has no coordinates in it. Type the place name instead, then press Find.";
  else if (md.locFound && parsed) note = "Found: " + md.locFound;
  else if (isShort) note = "Short Maps links hide the coordinates. Open the link, then copy the full URL — or type the place name and press Find.";
  else if (isUrl && !parsed) note = "No coordinates in that URL. Press Find to search by name, or right-click the place in Maps to copy its lat/lng.";
  return { hint, color, note, button: md.locBusy ? "…" : "Find" };
}

// ---------------------------------------------------------------- map tab

type Located = TripCard & { loc: LatLng };
const located = (c: TripCard): c is Located => !!c.loc && isFinite(c.loc.lat) && isFinite(c.loc.lng);

/** Located stops for a trip, in itinerary order (day, then card order). */
export function mapStops(cards: TripCard[]) {
  const idx = new Map(cards.map((c, i) => [c.id, i]));
  const loc = cards.filter(located);
  const sched = loc.filter((c) => c.day != null).sort((a, b) => a.day! - b.day! || idx.get(a.id)! - idx.get(b.id)!);
  const un = loc.filter((c) => c.day == null).sort((a, b) => idx.get(a.id)! - idx.get(b.id)!);
  return { loc, sched, un };
}

export type MapDay = "all" | "none" | number;

/** Numbered stops for the selected day (numbering restarts each day) plus unscheduled "ghost" pins. */
export function mapPlan(cards: TripCard[], day: MapDay) {
  const { sched, un } = mapStops(cards);
  const src = day === "all" ? sched : day === "none" ? [] : sched.filter((c) => c.day === day);
  const cnt: Record<number, number> = {};
  const numbered = src.map((c) => ({ c, n: (cnt[c.day!] = (cnt[c.day!] || 0) + 1) }));
  return { numbered, ghosts: day === "all" || day === "none" ? un : [] };
}

export interface BBox {
  s: number;
  n: number;
  w: number;
  e: number;
}

/** Bounding box of the stops, padded 35%, at least ~1.5 km across. */
export function mapBBox(list: { loc: LatLng }[]): BBox {
  let s = 90, n = -90, w = 180, e = -180;
  list.forEach((c) => {
    s = Math.min(s, c.loc.lat); n = Math.max(n, c.loc.lat);
    w = Math.min(w, c.loc.lng); e = Math.max(e, c.loc.lng);
  });
  const cy = (n + s) / 2, cx = (e + w) / 2;
  const dy = Math.max(n - s, 0.014) * 1.35, dx = Math.max(e - w, 0.014) * 1.35;
  return { s: cy - dy / 2, n: cy + dy / 2, w: cx - dx / 2, e: cx + dx / 2 };
}

export const mercY = (lat: number) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));

/** lon/lat → px for a W×H view that fits `b`. */
export function projector(b: BBox, W: number, H: number) {
  const y0 = mercY(b.n), y1 = mercY(b.s);
  const sc = Math.min(W / (b.e - b.w), H / (y0 - y1));
  const ox = W / 2 - ((b.w + b.e) / 2) * sc, oy = H / 2 + ((y0 + y1) / 2) * sc;
  return { x: (lon: number) => lon * sc + ox, y: (lat: number) => oy - mercY(lat) * sc };
}
