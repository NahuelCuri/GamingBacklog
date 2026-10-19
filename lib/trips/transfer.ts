// JSON export of one trip: the trip row plus its cards, in the same
// { trips, cards } shape as TripData (and the trip-planner-v1 local copy).
import { tripCards, type TripData } from "./model";

/** "Japón 2026" → "japon-2026"; falls back to "trip". */
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "trip";

/** backlog-trip-japon-2026-2026-10-18.json */
export const tripExportFileName = (name: string, now = new Date()) => `backlog-trip-${slug(name)}-${now.toISOString().slice(0, 10)}.json`;

/** The file for trip `id`, or null if it isn't in `data`. */
export function buildTripExport(data: TripData, id: string, now = new Date()) {
  const trip = data.trips.find((t) => t.id === id);
  if (!trip) return null;
  const out: TripData = { trips: [trip], cards: tripCards(data.cards, id) };
  return { fileName: tripExportFileName(trip.name || "", now), json: JSON.stringify(out, null, 2) };
}
