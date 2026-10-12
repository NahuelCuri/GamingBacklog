"use client";

// The trip map itself: MapLibre GL on OpenFreeMap's dark vector tiles,
// quietened to the Trip Planner palette. Loaded lazily from TripMap, so
// MapLibre only downloads when the Map tab opens.
import maplibregl, { LngLatBounds, type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { boxOf, minZoomFor, type LngLat, type MapArea, type MapPin, type MapScene } from "@/lib/trips/map-scene";
import { reducedMotion } from "@/lib/motion";
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

const areaData = (areas: MapArea[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: areas.map((a) => ({ type: "Feature", properties: { id: a.id, color: a.color }, geometry: { type: a.geometry.type, coordinates: a.geometry.coordinates } as GeoJSON.Geometry })),
});

/** Long titles are cut here: a symbol label can't ellipsize itself. */
const LABEL_MAX = 28;
const short = (t: string) => (t.length > LABEL_MAX ? t.slice(0, LABEL_MAX - 1).trimEnd() + "…" : t);

const pinData = (pins: MapPin[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: pins.map((p) => ({ type: "Feature", properties: { id: p.id, n: p.n, color: p.color, title: short(p.title) }, geometry: { type: "Point", coordinates: p.at } })),
});

/*
 * Pins and their titles are WebGL layers, not DOM markers: the GPU draws them
 * with the map, so panning and zooming cost the same with 5 stops or 50.
 * Hover and hidden titles are feature state, so they never re-upload data.
 */
const BG = "#0a0c0d";
const isN: maplibregl.ExpressionSpecification = [">", ["get", "n"], 0];
const isHot: maplibregl.ExpressionSpecification = ["boolean", ["feature-state", "hot"], false];
const isOff: maplibregl.ExpressionSpecification = ["boolean", ["feature-state", "off"], false];
/** Titles step aside while hot (the tooltip takes their place) and stay away once clicked off. */
const labelOpacity: maplibregl.ExpressionSpecification = ["case", ["any", isHot, isOff], 0, 1];
const fade = { duration: 140, delay: 0 };
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
  m.addLayer({
    id: "pin-label",
    type: "symbol",
    source: "pins",
    layout: {
      "text-field": ["get", "title"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11.5,
      "text-anchor": "bottom",
      // Above the dot: its radius, a gap and the plate's padding, in ems.
      "text-offset": ["case", isN, ["literal", [0, -2.2]], ["literal", [0, -1.55]]],
      "text-max-width": 30,
      "icon-image": "pin-plate",
      "icon-text-fit": "both",
      "icon-text-fit-padding": [4, 8, 4, 8],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "text-color": "#d9dfdd", "text-opacity": labelOpacity, "icon-opacity": labelOpacity, "text-opacity-transition": fade, "icon-opacity-transition": fade },
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
}

export default function TripMapCanvas({ scene, frame, overview, frameKey, hot, compact, onHot }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipAt = useRef<LngLat | null>(null);
  const map = useRef<MLMap | null>(null);
  const onHotRef = useRef(onHot);
  onHotRef.current = onHot;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<null | "webgl" | "tiles">(null);
  const padding = compact ? 40 : 70;
  // Latest frame for handlers set up once; and whether the user has moved the map themselves.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const overviewRef = useRef(overview);
  overviewRef.current = overview;
  const touched = useRef(false);

  // Only the one tooltip is DOM; it follows its pin as the map moves.
  const placeTip = () => {
    const m = map.current, tip = tipRef.current, at = tipAt.current;
    if (!m || !tip || !at) return;
    const pt = m.project(at);
    tip.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, calc(-100% - 20px))`;
  };

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
      // Bottom to top: district outlines, the route, then the pins and their titles.
      m.addSource("areas", { type: "geojson", data: areaData([]), promoteId: "id" });
      m.addLayer({ id: "area-fill", type: "fill", source: "areas", paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", isHot, 0.2, 0.08], "fill-opacity-transition": { duration: 150, delay: 0 } } });
      m.addLayer({ id: "area-line", type: "line", source: "areas", layout: { "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 1.4, "line-opacity": 0.6 } });
      m.addSource("route", { type: "geojson", data: routeData([]) });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": T.accent, "line-width": 1.6, "line-dasharray": [2, 2.5], "line-opacity": 0 },
      });
      addPinLayers(m);
      setReady(true);
    });
    // Only a style that never loads is fatal; a missing tile later is not.
    m.on("error", () => !loaded && setFailed("tiles"));

    // The pin (or its visible title) under the pointer, with a few pixels of slack.
    const pinAt = (p: maplibregl.Point) => {
      if (!m.getLayer("pin-dot")) return null;
      const hits = m.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers: PIN_LAYERS });
      const f = hits.find((h) => h.layer.id === "pin-dot" || !m.getFeatureState({ source: "pins", id: h.id! }).off);
      return f ? String(f.id) : null;
    };
    let over: string | null = null;
    const hover = (id: string | null) => {
      if (id === over) return;
      over = id;
      m.getCanvas().style.cursor = id ? "pointer" : "";
      onHotRef.current(id);
    };
    m.on("mousemove", (e) => hover(pinAt(e.point)));
    m.on("mouseout", () => hover(null));
    // A click on a pin or its title hides the title; a click on the pin brings it back.
    m.on("click", (e) => {
      const id = pinAt(e.point);
      if (!id) return;
      const off = !!m.getFeatureState({ source: "pins", id }).off;
      m.setFeatureState({ source: "pins", id }, { off: !off });
    });
    m.on("move", placeTip);
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
      m.remove();
      map.current = null;
    };
    // Created once; later frames go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins, outlines and route: replaced when the day filter or the stops change (every title shows again).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.removeFeatureState({ source: "pins" });
    m.removeFeatureState({ source: "areas" });
    (m.getSource("pins") as GeoJSONSource | undefined)?.setData(pinData(scene.pins));
    (m.getSource("areas") as GeoJSONSource | undefined)?.setData(areaData(scene.areas));
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

  // Hot pin (hovered here or in the side list): bigger, its district brighter, its tooltip shown.
  const hotPin = scene.pins.find((p) => p.id === hot) ?? null;
  tipAt.current = hotPin?.at ?? null;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !hot) return;
    m.setFeatureState({ source: "pins", id: hot }, { hot: true });
    m.setFeatureState({ source: "areas", id: hot }, { hot: true });
    return () => {
      if (!map.current) return;
      m.setFeatureState({ source: "pins", id: hot }, { hot: false });
      m.setFeatureState({ source: "areas", id: hot }, { hot: false });
    };
  }, [hot, ready, scene]);
  // Before paint, so the tooltip never shows a frame at the corner.
  useLayoutEffect(placeTip, [hotPin]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={box} data-testid="trip-map" style={{ position: "absolute", inset: 0, background: "#0a0c0d" }} aria-label="Map of the trip's stops" role="region" />
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
      {hotPin && (
        <div
          key={hotPin.id}
          ref={tipRef}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 7, background: "rgba(15,18,19,.96)", border: `1px solid ${T.border2}`, borderRadius: 9, padding: "8px 11px", maxWidth: 260, boxShadow: "0 10px 30px rgba(0,0,0,.5)", animation: "gfade 140ms ease-out" }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{(hotPin.n ? hotPin.n + ". " : "") + hotPin.title}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted2, marginTop: 3 }}>{hotPin.tip}</div>
        </div>
      )}
    </div>
  );
}
