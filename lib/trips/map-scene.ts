// What the trip Map tab shows for a day filter: pins, the route between a
// day's stops and the points to frame. Plain data, so the MapLibre canvas
// only has to draw it (and tests don't need WebGL).
import { mapPlan, typeMeta, type MapDay, type TripCard } from "./model";

export type LngLat = [number, number];

export interface MapPin {
  id: string;
  /** Stop number within its day; 0 for an unscheduled "ghost" pin. */
  n: number;
  color: string;
  at: LngLat;
  title: string;
  /** Tooltip line: type · day · start time · duration. */
  tip: string;
  /** Side-list line: type · start time · duration. */
  meta: string;
  day: number | null;
}

export interface MapScene {
  pins: MapPin[];
  /** One line per day, through that day's stops in order. */
  route: LngLat[][];
}

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function mapScene(cards: TripCard[], day: MapDay): MapScene {
  const { numbered, ghosts } = mapPlan(cards, day);
  const pin = (c: TripCard, n: number): MapPin => ({
    id: c.id,
    n,
    color: typeMeta(c.type).color,
    at: [c.loc!.lng, c.loc!.lat],
    title: c.title || "Untitled",
    tip: join([typeMeta(c.type).label, c.day != null ? "Day " + c.day : "Unscheduled", c.startTime, c.duration]),
    meta: n ? join([typeMeta(c.type).label, c.startTime, c.duration]) : join([typeMeta(c.type).label, c.duration]),
    day: c.day ?? null,
  });
  const pins = [...numbered.map(({ c, n }) => pin(c, n)), ...ghosts.map((c) => pin(c, 0))];

  const route: LngLat[][] = [];
  let prev: number | null | undefined;
  for (const p of pins) {
    if (!p.n) continue;
    if (p.day !== prev || !route.length) route.push([]);
    route[route.length - 1].push(p.at);
    prev = p.day;
  }
  return { pins, route: route.filter((l) => l.length > 1) };
}

/** Points to frame: the numbered stops when there are any, else every pin. */
export function framePoints(scene: MapScene): LngLat[] {
  const numbered = scene.pins.filter((p) => p.n);
  return (numbered.length ? numbered : scene.pins).map((p) => p.at);
}

/** Changes when the framed set of points does (not on edits that don't move a pin). */
export const frameKey = (pts: LngLat[]) => pts.map(([x, y]) => x.toFixed(5) + "," + y.toFixed(5)).join(";");

// ---------------------------------------------------------------- framing maths

export interface Box {
  w: number;
  s: number;
  e: number;
  n: number;
}

/** Smallest box we frame, in degrees (~1 km): a lone stop has no extent, and a point can't be fitted. */
export const MIN_SPAN = 0.01;

/** Box around the points, at least MIN_SPAN across, so one stop (or several on one spot) still frames. */
export function boxOf(pts: LngLat[]): Box {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hx = Math.max(Math.max(...xs) - Math.min(...xs), MIN_SPAN) / 2, hy = Math.max(Math.max(...ys) - Math.min(...ys), MIN_SPAN) / 2;
  return { w: cx - hx, s: cy - hy, e: cx + hx, n: cy + hy };
}

/** Web Mercator y of a latitude, as a fraction of the world's height. */
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

/**
 * Zoom at which a box fits a W×H view inside the padding (MapLibre's world is
 * 512px wide at zoom 0). Always a number, unlike MapLibre's cameraForBounds,
 * which returns nothing while the map has no size or the padding doesn't fit.
 */
export function fitZoom(b: Box, W: number, H: number, pad: number) {
  const dx = (b.e - b.w) / 360, dy = Math.abs(mercY(b.s) - mercY(b.n));
  const w = Math.max(W - 2 * pad, 64), h = Math.max(H - 2 * pad, 64);
  return Math.log2(Math.min(w / (dx * 512), h / (dy * 512)));
}

/** How far out the map may zoom: `outPast` levels beyond the whole trip, but never tighter than `floor`. */
export function minZoomFor(overview: LngLat[], W: number, H: number, pad: number, o: { maxZoom: number; outPast: number; floor: number }) {
  const z = Math.min(fitZoom(boxOf(overview), W, H, pad), o.maxZoom);
  return Math.max(0, Math.min(z - o.outPast, o.floor));
}
