"use client";

// The trip map itself: MapLibre GL on OpenFreeMap's dark vector tiles,
// quietened to the Trip Planner palette. Loaded lazily from TripMap, so
// MapLibre only downloads when the Map tab opens.
import maplibregl, { LngLatBounds, type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { stopsIn, type Districts } from "@/lib/trips/districts";
import { boxOf, minZoomFor, type LngLat, type MapPin, type MapScene } from "@/lib/trips/map-scene";
import { play, reducedMotion } from "@/lib/motion";
import { T } from "./styles";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
/** Furthest a fit zooms in; users can go a bit closer by hand. */
const MAX_ZOOM = 15;
const USER_MAX_ZOOM = 17;
/** How far out past the whole trip one can zoom (keeps the tile cache small, too). */
const OUT_PAST_TRIP = 2;
const CITY_ZOOM = 10;

/*
 * A quiet basemap: the pins and route carry the colour, the map only gives
 * bearings. Water and main roads always; minor streets and their names only
 * close in (street level), city names only zoomed out. Layer ids are
 * OpenFreeMap "dark".
 */
const HIDDEN = [
  "building", "landuse_residential", "landcover_wood", "landuse_park", "landcover_ice_shelf", "landcover_glacier",
  "aeroway-taxiway", "aeroway-runway-casing", "aeroway-area", "aeroway-runway", "road_area_pier", "road_pier",
  "railway_transit", "railway_transit_dashline", "railway_minor", "railway_minor_dashline", "railway", "railway_dashline",
  "road_oneway", "road_oneway_opposite", "highway_path", "highway_major_casing", "highway_motorway_casing",
  "boundary_state", "boundary_country_z0-4", "boundary_country_z5-", "water_name", "highway_name_motorway",
  "place_other", "place_village", "place_state", "place_country_other", "place_country_minor", "place_country_major",
];

const PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#0a0c0d" },
  water: { "fill-color": "#0c1416" },
  waterway: { "line-color": "#0f191b" },
  highway_minor: { "line-color": "#141a1b" },
  highway_major_inner: { "line-color": "#192022" },
  highway_major_subtle: { "line-color": "#171d1f" },
  highway_motorway_inner: { "line-color": "#1d2527" },
  highway_motorway_subtle: { "line-color": "#1a2123" },
  highway_name_other: { "text-color": "#46504e", "text-halo-color": "#0a0c0d" },
  place_city_large: { "text-color": "#56615e", "text-halo-color": "#0a0c0d" },
  place_city: { "text-color": "#56615e", "text-halo-color": "#0a0c0d" },
  place_town: { "text-color": "#4a5452", "text-halo-color": "#0a0c0d" },
  place_suburb: { "text-color": "#3f4947", "text-halo-color": "#0a0c0d" },
};

/** [min, max] zoom per layer, intersected with the style's own range. */
const ZOOM: Record<string, [number, number]> = {
  highway_minor: [14, 24],
  highway_name_other: [15, 24],
  place_suburb: [12, 15],
  place_town: [0, 13],
  place_city: [0, 12],
  place_city_large: [0, 11],
};

function restyle(m: MLMap) {
  for (const id of HIDDEN) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
  for (const [id, paint] of Object.entries(PAINT)) {
    if (!m.getLayer(id)) continue;
    for (const [k, v] of Object.entries(paint)) m.setPaintProperty(id, k, v);
  }
  for (const [id, [lo, hi]] of Object.entries(ZOOM)) {
    const l = m.getLayer(id);
    if (l) m.setLayerZoomRange(id, Math.max(lo, l.minzoom ?? 0), Math.min(hi, l.maxzoom ?? 24));
  }
}

/** MapLibre bounds for the points (see boxOf for the minimum size). */
function boundsOf(pts: LngLat[]) {
  const b = boxOf(pts);
  return new LngLatBounds([b.w, b.s], [b.e, b.n]);
}

const minZoom = (overview: LngLat[], W: number, H: number, pad: number) =>
  minZoomFor(overview, W, H, pad, { maxZoom: MAX_ZOOM, outPast: OUT_PAST_TRIP, floor: CITY_ZOOM });

const routeData = (route: LngLat[][]): GeoJSON.Feature => ({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: route } });

/** Long titles are cut here: a symbol label can't ellipsize itself. */
const LABEL_MAX = 28;
const shortTitle = (t: string) => (t.length > LABEL_MAX ? t.slice(0, LABEL_MAX - 1).trimEnd() + "…" : t);

/**
 * Which title keeps a crowded spot (lower wins): the day's stops in order,
 * then unscheduled "must" cards, then the rest.
 */
const rank = (p: MapPin, i: number) => (p.n ? p.n : (p.must ? 1000 : 2000) + i);

/** `off`: titles clicked off. They leave the data, so they free their spot for the others. */
const pinData = (pins: MapPin[], off: ReadonlySet<string> = new Set()): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: pins.map((p, i) => ({
    type: "Feature",
    properties: { id: p.id, n: p.n, color: p.color, title: shortTitle(p.title), tip: (p.n ? "#" + p.n + " · " : "") + p.tip, rank: rank(p, i), off: off.has(p.id) },
    geometry: { type: "Point", coordinates: p.at },
  })),
});

/*
 * Pins, their titles and the hover card are all WebGL layers, not DOM: the GPU
 * draws them with the map, so panning and zooming cost the same with 5 stops
 * or 50, and the card's title is the standing title's own pixels.
 * Titles that would overlap give way (the map places them as it does its own
 * labels), and come back as the zoom makes room. Hover is feature state.
 */
const BG = "#0a0c0d";
const TITLE = "#d9dfdd";
const CLEAR = "rgba(0,0,0,0)";
const isN: maplibregl.ExpressionSpecification = [">", ["get", "n"], 0];
const isHot: maplibregl.ExpressionSpecification = ["boolean", ["feature-state", "hot"], false];
const PIN_LAYERS = ["pin-label", "pin-dot"];

/** Rounded dark plate behind a title, stretched to fit it (drawn at 2x). */
function labelPlate() {
  const S = 48;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.roundRect(1, 1, S - 2, S - 2, 14);
  g.fillStyle = "rgba(15,18,19,.94)";
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = "#2a3233";
  g.stroke();
  return g.getImageData(0, 0, S, S);
}

/** A plate's padding around its text, in px: top, right, bottom, left. */
type Pad = [number, number, number, number];
const TITLE_PAD: Pad = [4, 8, 4, 8];
/** The card's plate: roomier above and to the sides, but the same bottom, so the title doesn't move. */
const CARD_PAD: Pad = [7, 11, 4, 11];

/**
 * A title on its plate, above the dot. The hover card is this too, with the
 * details line stacked on top. `standing` titles collide: one that would cover
 * another (or be covered) is left out; cards always draw.
 */
const labelLayout = (text: maplibregl.ExpressionSpecification, pad: Pad | null, standing = false): maplibregl.SymbolLayerSpecification["layout"] => ({
  "text-field": text,
  "text-font": ["Noto Sans Bold"],
  "text-size": 11.5,
  "text-anchor": "bottom",
  // Above the dot: its radius, a gap and the plate's padding, in ems.
  "text-offset": ["case", isN, ["literal", [0, -2.2]], ["literal", [0, -1.55]]],
  "text-max-width": 30,
  "text-allow-overlap": !standing,
  "text-ignore-placement": !standing,
  ...(standing && { "symbol-sort-key": ["get", "rank"] }),
  ...(pad && {
    "icon-image": "pin-plate",
    "icon-text-fit": "both",
    "icon-text-fit-padding": pad,
    "icon-allow-overlap": !standing,
    "icon-ignore-placement": !standing,
  }),
});

/**
 * The card's text: details line over the title. Anchored at the bottom like
 * the standing title, so its title line lands on exactly the same pixels. One
 * layer draws the plate and title, another only the details line, so the
 * details can rise in on their own.
 */
const cardText = (details: boolean): maplibregl.ExpressionSpecification => [
  "format",
  ["get", "tip"],
  { "text-font": ["literal", ["Noto Sans Regular"]], "font-scale": 0.9, "text-color": details ? T.muted2 : CLEAR },
  "\n",
  {},
  ["get", "title"],
  { "text-color": details ? CLEAR : TITLE },
];

/**
 * Two card slots, so one card can fade out while the next fades in. A slot
 * shows one pin through its filter; with a single feature in it, its paint is
 * the card's own and fades with ordinary paint transitions.
 */
const SLOTS = ["card-0", "card-1"];
const nobody: maplibregl.FilterSpecification = ["==", ["get", "id"], ""];
/** Details line: from a little low, up into place. */
const TIP_DROP: [number, number] = [0, 5];

function addPinLayers(m: MLMap) {
  m.addImage("pin-plate", labelPlate(), { pixelRatio: 2, stretchX: [[16, 32]], stretchY: [[16, 32]] });
  m.addSource("pins", { type: "geojson", data: pinData([]), promoteId: "id" });
  m.addLayer({
    id: "pin-dot",
    type: "circle",
    source: "pins",
    // Numbered stops above the unscheduled rings.
    layout: { "circle-sort-key": ["case", isN, 1, 0] },
    paint: {
      "circle-radius": ["*", ["case", isN, 11.5, 4.6], ["case", isHot, 1.3, 1]],
      "circle-radius-transition": { duration: 180, delay: 0 },
      "circle-color": ["case", isN, ["get", "color"], BG],
      "circle-stroke-color": ["case", isN, BG, ["get", "color"]],
      "circle-stroke-width": ["case", isN, 2.5, 2.4],
    },
  });
  m.addLayer({
    id: "pin-n",
    type: "symbol",
    source: "pins",
    filter: isN,
    layout: { "text-field": ["to-string", ["get", "n"]], "text-font": ["Noto Sans Bold"], "text-size": 12.5, "text-allow-overlap": true, "text-ignore-placement": true },
    paint: { "text-color": BG },
  });
  // Titles hide once clicked off.
  m.addLayer({ id: "pin-label", type: "symbol", source: "pins", filter: ["!", ["get", "off"]], layout: labelLayout(["get", "title"], TITLE_PAD, true), paint: { "text-color": TITLE } });
  for (const s of SLOTS) {
    m.addLayer({ id: s, type: "symbol", source: "pins", filter: nobody, layout: labelLayout(cardText(false), CARD_PAD), paint: { "text-opacity": 0, "icon-opacity": 0 } });
    m.addLayer({ id: s + "-tip", type: "symbol", source: "pins", filter: nobody, layout: labelLayout(cardText(true), null), paint: { "text-opacity": 0, "text-translate": TIP_DROP } });
  }
}

interface Slot {
  id: string | null;
  /** Showing (or fading in), as opposed to fading out. */
  live: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const OUT = 140;

/** Fade a slot's card in or out; `now` jumps there (a fresh pin, or reduced motion). */
function cardTo(m: MLMap, s: string, on: boolean, now: boolean) {
  const t = (duration: number, delay = 0) => (now ? { duration: 0, delay: 0 } : { duration, delay });
  m.setPaintProperty(s, "icon-opacity-transition", t(on ? 160 : OUT));
  m.setPaintProperty(s, "text-opacity-transition", t(on ? 160 : OUT));
  m.setPaintProperty(s, "icon-opacity", on ? 1 : 0);
  m.setPaintProperty(s, "text-opacity", on ? 1 : 0);
  // The details rise in once the card is mostly up, and leave first.
  m.setPaintProperty(s + "-tip", "text-opacity-transition", t(on ? 200 : 90, on ? 70 : 0));
  m.setPaintProperty(s + "-tip", "text-translate-transition", t(on ? 280 : 120, on ? 40 : 0));
  m.setPaintProperty(s + "-tip", "text-opacity", on ? 1 : 0);
  m.setPaintProperty(s + "-tip", "text-translate", on ? [0, 0] : TIP_DROP);
}

function cardFor(m: MLMap, s: string, id: string | null) {
  const f: maplibregl.FilterSpecification = id ? ["==", ["get", "id"], id] : nobody;
  m.setFilter(s, f);
  m.setFilter(s + "-tip", f);
}

/** `stops`: how many of the shown stops each district holds. */
const districtData = (d: Districts | null, stops: Map<number, number>): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: (d?.zones ?? []).map((z) => ({ type: "Feature", id: z.id, properties: { name: z.name, stops: stops.get(z.id) ?? 0 }, geometry: { type: "MultiPolygon", coordinates: z.rings.map((r) => [r]) } })),
});

/** A ring's signed area and centroid (shoelace). */
function ringCentre(r: LngLat[]) {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    a += f;
    x += (r[i][0] + r[i + 1][0]) * f;
    y += (r[i][1] + r[i + 1][1]) * f;
  }
  return { area: Math.abs(a / 2), at: (a ? [x / (3 * a), y / (3 * a)] : r[0]) as LngLat };
}

/**
 * One name per district, as a point at the centre of its largest part: a
 * polygon gets a label in every map tile it crosses, so big ones would repeat.
 */
const districtNames = (d: Districts | null, stops: Map<number, number>): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: (d?.zones ?? []).map((z) => {
    const main = z.rings.map(ringCentre).reduce((a, c) => (c.area > a.area ? c : a));
    return { type: "Feature", id: z.id, properties: { name: z.name, stops: stops.get(z.id) ?? 0 }, geometry: { type: "Point", coordinates: main.at } };
  }),
});

/**
 * The districts toggle: quiet outlines and names under the route, the one
 * under the pointer a little lit. Districts holding stops are a shade brighter
 * and carry their count ("CHUO · 4").
 */
function addDistrictLayers(m: MLMap) {
  const lit: maplibregl.ExpressionSpecification = ["boolean", ["feature-state", "lit"], false];
  const visited: maplibregl.ExpressionSpecification = [">", ["get", "stops"], 0];
  m.addSource("districts", { type: "geojson", data: districtData(null, new Map()) });
  m.addSource("district-names", { type: "geojson", data: districtNames(null, new Map()) });
  m.addLayer({ id: "district-fill", type: "fill", source: "districts", paint: { "fill-color": "#9fb7b2", "fill-opacity": ["case", lit, 0.1, visited, 0.05, 0.02] } });
  m.addLayer({ id: "district-line", type: "line", source: "districts", layout: { "line-join": "round" }, paint: { "line-color": "#55625f", "line-width": 1.2 } });
  m.addLayer({
    id: "district-name",
    type: "symbol",
    source: "district-names",
    layout: { "text-field": ["case", visited, ["concat", ["get", "name"], "  ·  ", ["to-string", ["get", "stops"]]], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-transform": "uppercase", "text-letter-spacing": 0.08, "text-max-width": 8 },
    paint: { "text-color": ["case", lit, "#a3b0ad", visited, "#8a9895", "#66726f"], "text-halo-color": BG, "text-halo-width": 1.2 },
  });
}

/*
 * Transit, from the basemap's own tiles (no extra requests): rail and metro
 * lines, and stations with their names. Lines carry no colour or line name in
 * these tiles, so they're one quiet blue; underground runs are dashed.
 * Stations are small squares, so they never read as the trip's round pins.
 */
const TRANSIT_LINES = ["transit-line", "transit-tunnel"];
const STATION_LAYERS = ["station"];
const RAIL_LINE: maplibregl.ExpressionSpecification = ["all", ["match", ["get", "class"], ["rail", "transit"], true, false], ["!", ["has", "service"]]];
const isTunnel: maplibregl.ExpressionSpecification = ["==", ["get", "brunnel"], "tunnel"];
const RAIL_BLUE = "#6d86a8";

/** A rounded square with a light edge, drawn at 2x. */
function stationMark() {
  const S = 22;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.roundRect(3, 3, S - 6, S - 6, 4);
  g.fillStyle = "#0f1517";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = "#a9bcd6";
  g.stroke();
  return g.getImageData(0, 0, S, S);
}

function addTransitLayers(m: MLMap) {
  const width: maplibregl.ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 10, 0.7, 15, 1.8];
  const off = { visibility: "none" as const };
  m.addLayer({ id: "transit-line", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["all", RAIL_LINE, ["!", isTunnel]], layout: { ...off, "line-join": "round" }, paint: { "line-color": RAIL_BLUE, "line-width": width, "line-opacity": 0.6 } });
  m.addLayer({ id: "transit-tunnel", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["all", RAIL_LINE, isTunnel], layout: off, paint: { "line-color": RAIL_BLUE, "line-width": width, "line-opacity": 0.45, "line-dasharray": [2, 2] } });
}

function addStationLayer(m: MLMap) {
  m.addImage("station", stationMark(), { pixelRatio: 2 });
  m.addLayer({
    id: "station",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: 12,
    filter: ["all", ["==", ["get", "class"], "railway"], ["match", ["get", "subclass"], ["station", "subway", "halt"], true, false]],
    layout: {
      visibility: "none",
      // The busiest first. A station is listed once per line (Ginza three times,
      // a block apart); a wide margin round each mark lets one stand for all.
      "symbol-sort-key": ["get", "rank"],
      "icon-image": "station",
      "icon-padding": 16,
      "text-field": ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name_int"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10.5,
      "text-anchor": "left",
      "text-offset": [0.75, 0],
      "text-max-width": 9,
      // A crowded name gives way; its mark stays.
      "text-optional": true,
    },
    paint: { "text-color": "#93a6c0", "text-halo-color": BG, "text-halo-width": 1.2 },
  });
}

interface Props {
  scene: MapScene;
  /** Points to frame, and a key that changes whenever the view should re-frame. */
  frame: LngLat[];
  /** Every located stop: sets how far out the map can zoom. */
  overview: LngLat[];
  frameKey: string;
  hot: string | null;
  compact: boolean;
  onHot(id: string | null): void;
  /** Outlined under the stops when the districts toggle is on. */
  districts: Districts | null;
  /** Rail and metro lines from the basemap. */
  transit: boolean;
  /** Stations and their names from the basemap. */
  stations: boolean;
  /** The pin opened into a bubble (double-click), and what the bubble shows. */
  open: string | null;
  /** Opens a pin (double-click), or closes the bubble (null) when the user zooms. */
  onOpen(id: string | null): void;
  /** Bumped when the open pin is opened again: the bubble calls attention to itself. */
  nudge: number;
  bubble: ReactNode;
}

/** Opening a pin always lands at this zoom, in or out from wherever the map is. */
const OPEN_ZOOM = 15;
/** Opening a pin: the camera's move, and when (into it) the bubble starts to grow. */
const ZOOM_IN = 850;
const BLOOM_AT = 500;

/** Bubble's gap above the pin's centre: past the dot, where its title sits. */
const lift = (p: MapPin) => (p.n ? 19 : 11);

export default function TripMapCanvas({ scene, frame, overview, frameKey, hot, compact, onHot, districts, transit, stations, open, onOpen, nudge, bubble }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  // The hover card slots: the hot pin's card, and one still fading out.
  const slots = useRef<Slot[]>(SLOTS.map(() => ({ id: null, live: false })));
  // Titles clicked off (until the stops or the day change), and the scene for handlers set up once.
  const offRef = useRef(new Set<string>());
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const onHotRef = useRef(onHot);
  onHotRef.current = onHot;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const openRef = useRef(open);
  openRef.current = open;
  // The bubble stays drawn while it fades out, showing what it last showed.
  const bubbleEl = useRef<HTMLDivElement>(null);
  const shown = useRef<{ id: string; node: ReactNode } | null>(null);
  if (open) shown.current = { id: open, node: bubble };
  const [, closed] = useState(0);
  const [bubbleMax, setBubbleMax] = useState(400);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<null | "webgl" | "tiles">(null);
  const padding = compact ? 40 : 70;
  // Latest frame for handlers set up once; and whether the user has moved the map themselves.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const overviewRef = useRef(overview);
  overviewRef.current = overview;
  const touched = useRef(false);

  // The map is created once; everything else updates it in place.
  useEffect(() => {
    let m: MLMap;
    let loaded = false;
    // A new map (remount, hot reload) isn't ready until its own style loads.
    setReady(false);
    const el = box.current!;
    const size = () => [el.clientWidth || innerWidth, el.clientHeight || innerHeight] as const;
    const limitZoom = () => {
      if (overviewRef.current.length) m.setMinZoom(minZoom(overviewRef.current, ...size(), padding));
    };
    try {
      m = new maplibregl.Map({
        container: box.current!,
        style: STYLE_URL,
        bounds: boundsOf(frame),
        fitBoundsOptions: { padding, maxZoom: MAX_ZOOM },
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        maxZoom: USER_MAX_ZOOM,
        minZoom: overview.length ? minZoom(overview, ...size(), padding) : 0,
        // Memory: sharp enough on high-density screens without rendering at 3x,
        // and keep cached tiles to two zoom levels around the current one.
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        maxTileCacheZoomLevels: 2,
      });
    } catch {
      setFailed("webgl");
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.on("style.load", () => {
      loaded = true;
      restyle(m);
      // Bottom to top: districts, the route, then the pins and their titles.
      addDistrictLayers(m);
      addTransitLayers(m);
      m.addSource("route", { type: "geojson", data: routeData([]) });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": T.accent, "line-width": 1.6, "line-dasharray": [2, 2.5], "line-opacity": 0 },
      });
      // Stations under the pins, so a pin's title wins the spot over a station's name.
      addStationLayer(m);
      addPinLayers(m);
      setReady(true);
    });
    // Only a style that never loads is fatal; a missing tile later is not.
    m.on("error", () => !loaded && setFailed("tiles"));

    // The pin (or its visible title) under the pointer, with a few pixels of slack.
    const pinAt = (p: maplibregl.Point) => {
      if (!m.getLayer("pin-dot")) return null;
      const hits = m.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers: PIN_LAYERS });
      // A pin before a title (a title may cover another pin); only drawn titles count.
      const f = hits.find((h) => h.layer.id === "pin-dot") ?? hits[0];
      return f ? String(f.id) : null;
    };
    let over: string | null = null;
    const hover = (id: string | null) => {
      if (id === over) return;
      over = id;
      m.getCanvas().style.cursor = id ? "pointer" : "";
      onHotRef.current(id);
    };
    // The district under the pointer, unless a pin is.
    let zone: string | number | null = null;
    const light = (id: string | number | null) => {
      if (id === zone) return;
      for (const source of ["districts", "district-names"]) {
        if (zone != null) m.setFeatureState({ source, id: zone }, { lit: false });
        if (id != null) m.setFeatureState({ source, id }, { lit: true });
      }
      zone = id;
    };
    m.on("mousemove", (e) => {
      const pin = pinAt(e.point);
      hover(pin);
      light(pin || !m.getLayer("district-fill") ? null : (m.queryRenderedFeatures(e.point, { layers: ["district-fill"] })[0]?.id ?? null));
    });
    m.on("mouseout", () => {
      hover(null);
      light(null);
    });
    // A click on a pin or its title hides the title; a click on the pin brings it back.
    // While a bubble is open, a click only closes it.
    let closeSoon: ReturnType<typeof setTimeout> | undefined;
    m.on("click", (e) => {
      const id = pinAt(e.point);
      const o = openRef.current;
      if (o) {
        clearTimeout(closeSoon);
        // A click on the open pin waits a moment: it may be a double-click on it.
        if (id === o) closeSoon = setTimeout(() => onOpenRef.current(null), 260);
        else onOpenRef.current(null);
        return;
      }
      if (!id) return;
      const off = offRef.current;
      if (!off.delete(id)) off.add(id);
      (m.getSource("pins") as GeoJSONSource | undefined)?.setData(pinData(sceneRef.current.pins, off));
    });
    // A double-click on a pin opens it into a bubble (the camera moves there
    // itself); anywhere else it zooms in as usual.
    m.on("dblclick", (e) => {
      const id = pinAt(e.point);
      if (!id) return;
      e.preventDefault();
      clearTimeout(closeSoon);
      onOpenRef.current(id);
    });
    // Zooming by hand closes the bubble (our own easeTo has no originalEvent).
    m.on("zoomstart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent && openRef.current) onOpenRef.current(null);
    });
    // A user pan or zoom (not our fitBounds) means their view wins over re-framing on resize.
    m.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) touched.current = true;
    });
    m.on("resize", () => {
      limitZoom();
      if (!touched.current && frameRef.current.length) m.fitBounds(boundsOf(frameRef.current), { padding, maxZoom: MAX_ZOOM, duration: 0 });
    });
    m.on("load", limitZoom);
    map.current = m;
    return () => {
      clearTimeout(closeSoon);
      m.remove();
      map.current = null;
    };
    // Created once; later frames go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins and route: replaced when the day filter or the stops change (every title shows again).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.removeFeatureState({ source: "pins" });
    offRef.current.clear();
    slots.current.forEach((sl, i) => {
      clearTimeout(sl.timer);
      Object.assign(sl, { id: null, live: false });
      cardFor(m, SLOTS[i], null);
    });
    (m.getSource("pins") as GeoJSONSource | undefined)?.setData(pinData(scene.pins));
    (m.getSource("route") as GeoJSONSource | undefined)?.setData(routeData(scene.route));
    // The route fades in after the pins.
    const numbered = scene.pins.filter((p) => p.n).length;
    m.setPaintProperty("route", "line-opacity-transition", { duration: 0, delay: 0 });
    m.setPaintProperty("route", "line-opacity", 0);
    const t = requestAnimationFrame(() => {
      if (!map.current) return;
      m.setPaintProperty("route", "line-opacity-transition", reducedMotion() ? { duration: 0, delay: 0 } : { duration: 400, delay: Math.min(numbered, 15) * 25 });
      m.setPaintProperty("route", "line-opacity", 0.55);
    });
    return () => cancelAnimationFrame(t);
  }, [scene, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.removeFeatureState({ source: "districts" });
    m.removeFeatureState({ source: "district-names" });
    // Which district each shown stop falls in: a point-in-polygon pass, a few ms even for 50 stops.
    const stops = districts ? stopsIn(districts.zones, scene.pins.map((p) => p.at)) : new Map<number, number>();
    (m.getSource("districts") as GeoJSONSource | undefined)?.setData(districtData(districts, stops));
    (m.getSource("district-names") as GeoJSONSource | undefined)?.setData(districtNames(districts, stops));
    // The basemap's own neighbourhood names would repeat ours.
    if (m.getLayer("place_suburb")) m.setLayoutProperty("place_suburb", "visibility", districts ? "none" : "visible");
  }, [districts, scene, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const id of TRANSIT_LINES) m.setLayoutProperty(id, "visibility", transit ? "visible" : "none");
    for (const id of STATION_LAYERS) m.setLayoutProperty(id, "visibility", stations ? "visible" : "none");
  }, [transit, stations, ready]);

  // Zooming out stops a little past the whole trip.
  const overviewKey = overview.map((p) => p.join(",")).join(";");
  useEffect(() => {
    const m = map.current;
    if (!m || !overview.length) return;
    const c = m.getContainer();
    m.setMinZoom(minZoom(overview, c.clientWidth || innerWidth, c.clientHeight || innerHeight, padding));
    // overview is read through overviewKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewKey, padding]);

  // Re-frame on a new day, reset, or stops being added/moved (the first frame is the initial bounds).
  const firstFrame = useRef(true);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (firstFrame.current) {
      firstFrame.current = false;
      return;
    }
    if (!frame.length) return;
    touched.current = false;
    m.fitBounds(boundsOf(frame), { padding, maxZoom: MAX_ZOOM, duration: reducedMotion() ? 0 : 700 });
    // frame is read through frameKey, which changes exactly when it should re-frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, padding]);

  // The open pin: the camera flies to it at OPEN_ZOOM, leaving room above for
  // the bubble, which grows out of the pin's title and then follows the pin.
  useLayoutEffect(() => {
    const m = map.current;
    const pin = open ? scene.pins.find((p) => p.id === open) : undefined;
    if (!m || !ready || !pin) return;
    const H = m.getContainer().clientHeight;
    setBubbleMax(Math.max(160, Math.round(H * 0.62)));
    touched.current = true;
    const still = reducedMotion();
    m.easeTo({ center: pin.at, zoom: OPEN_ZOOM, offset: [0, Math.round(H * 0.3)], duration: still ? 0 : ZOOM_IN });
    const place = () => {
      const el = bubbleEl.current;
      if (!el) return;
      const { x, y } = m.project(pin.at);
      el.style.transform = `translate(${x}px, ${y - lift(pin)}px) translate(-50%, -100%)`;
    };
    place();
    // The bubble waits out most of the zoom, then grows as the camera settles.
    play(bubbleEl.current?.firstElementChild, [{ opacity: 0, transform: "scale(.22)" }, { opacity: 1, transform: "none" }], { duration: 340, delay: BLOOM_AT });
    // Its own title would peek out from under it, once it's up.
    const hide = setTimeout(() => map.current && m.setFilter("pin-label", ["all", ["!", ["get", "off"]], ["!=", ["get", "id"], pin.id]]), still ? 0 : BLOOM_AT);
    m.on("move", place);
    m.on("resize", place);
    return () => {
      m.off("move", place);
      m.off("resize", place);
      clearTimeout(hide);
      if (map.current) m.setFilter("pin-label", ["!", ["get", "off"]]);
    };
    // Re-runs for another pin, not for edits to this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  // The open pin double-clicked again: back to it if the map has wandered,
  // then the bubble bounces lightly, so the eye finds it.
  useEffect(() => {
    const m = map.current;
    const pin = open ? sceneRef.current.pins.find((p) => p.id === open) : undefined;
    if (!nudge || !m || !pin) return;
    const c = m.getContainer();
    const off: [number, number] = [0, Math.round(c.clientHeight * 0.3)];
    const { x, y } = m.project(pin.at);
    const away = Math.hypot(x - c.clientWidth / 2, y - (c.clientHeight / 2 + off[1])) > 8 || Math.abs(m.getZoom() - OPEN_ZOOM) > 0.05;
    if (away) m.easeTo({ center: pin.at, zoom: OPEN_ZOOM, offset: off, duration: reducedMotion() ? 0 : 500 });
    // A small hop, and a smaller one as it settles.
    const a = play(
      bubbleEl.current?.firstElementChild,
      [
        { transform: "none" },
        { transform: "translateY(-6px)", offset: 0.3 },
        { transform: "none", offset: 0.6 },
        { transform: "translateY(-2px)", offset: 0.8 },
        { transform: "none" },
      ],
      { duration: 460, delay: away ? 380 : 0, easing: "ease-out", fill: "none" },
    );
    return () => a?.cancel();
    // Only a new nudge plays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);

  // Closing: the bubble shrinks back into the pin, then goes.
  useEffect(() => {
    if (open || !shown.current) return;
    const done = () => {
      if (openRef.current) return;
      shown.current = null;
      closed((n) => n + 1);
    };
    const a = play(bubbleEl.current?.firstElementChild, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.4)" }], { duration: 150, easing: "ease-in", fill: "forwards" });
    if (!a) return done();
    a.onfinish = done;
    return () => a.cancel();
  }, [open]);

  // Hot pin (hovered here or in the side list): bigger, its card up.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    // The open pin's bubble stands in for its card.
    const id = hot && hot !== open && scene.pins.some((p) => p.id === hot) ? hot : null;
    const still = reducedMotion();
    const all = slots.current;
    // Any other card fades out, then lets its slot go.
    all.forEach((sl, i) => {
      if (!sl.live || sl.id === id) return;
      sl.live = false;
      cardTo(m, SLOTS[i], false, still);
      sl.timer = setTimeout(() => {
        if (sl.live || !map.current) return;
        sl.id = null;
        cardFor(m, SLOTS[i], null);
      }, still ? 0 : OUT + 60);
    });
    if (!id) return;
    // Its own card if still fading out, else a free slot, else the one fading out.
    const i = Math.max(all.findIndex((sl) => sl.id === id), all.findIndex((sl) => !sl.id), all.findIndex((sl) => !sl.live));
    const sl = all[i];
    clearTimeout(sl.timer);
    sl.live = true;
    // Drawn above the card it replaces.
    m.moveLayer(SLOTS[i]);
    m.moveLayer(SLOTS[i] + "-tip");
    if (sl.id === id) return cardTo(m, SLOTS[i], true, still);
    // A new pin starts from nothing. The filter change lays the slot out again
    // off the main thread, so the fade waits until the card is actually drawn.
    sl.id = id;
    cardTo(m, SLOTS[i], false, true);
    cardFor(m, SLOTS[i], id);
    let f = 0;
    let tries = 0;
    const start = () => {
      if (!sl.live || sl.id !== id || !map.current) return;
      if (m.queryRenderedFeatures({ layers: [SLOTS[i]] }).length || ++tries > 20) return cardTo(m, SLOTS[i], true, still);
      f = requestAnimationFrame(start);
    };
    f = requestAnimationFrame(start);
    return () => cancelAnimationFrame(f);
  }, [hot, scene, ready, open]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !hot) return;
    m.setFeatureState({ source: "pins", id: hot }, { hot: true });
    return () => {
      if (!map.current) return;
      m.setFeatureState({ source: "pins", id: hot }, { hot: false });
    };
  }, [hot, ready, scene]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={box} data-testid="trip-map" style={{ position: "absolute", inset: 0, background: "#0a0c0d" }} aria-label="Map of the trip's stops" role="region" />
      {shown.current && (
        <div ref={bubbleEl} style={{ position: "absolute", left: 0, top: 0, zIndex: 5, pointerEvents: "none", willChange: "transform" }}>
          <div style={{ transformOrigin: "50% 100%", pointerEvents: open ? "auto" : "none", ["--bubble-max" as string]: bubbleMax + "px" }}>{shown.current.node}</div>
        </div>
      )}
      {!ready && !failed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: T.mono, fontSize: 12, color: T.dim2 }}>
          loading map…
        </div>
      )}
      {failed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", padding: "0 30px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.dim }}>{failed === "webgl" ? "This browser can't draw the map" : "Map tiles unavailable"}</div>
          <div style={{ fontSize: 12.5, color: T.faint }}>{failed === "webgl" ? "WebGL is off or unsupported. The stop list still works." : "Check your connection and reopen the tab."}</div>
        </div>
      )}
    </div>
  );
}
