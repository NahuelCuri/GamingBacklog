"use client";

// The trip map itself: MapLibre GL on OpenFreeMap's dark vector tiles,
// quietened to the Trip Planner palette. Loaded lazily from TripMap, so
// MapLibre only downloads when the Map tab opens.
import maplibregl, { LngLatBounds, type GeoJSONSource, type Map as MLMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { boxOf, minZoomFor, type LngLat, type MapPin, type MapScene } from "@/lib/trips/map-scene";
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

function pinElement(p: MapPin, delay: number) {
  const el = document.createElement("div");
  el.className = "trip-pin";
  el.setAttribute("aria-hidden", "true"); // the side list is the accessible way in
  el.style.zIndex = p.n ? "2" : "1";
  const dot = document.createElement("span");
  dot.className = p.n ? "trip-pin-n" : "trip-pin-ghost";
  dot.style.setProperty("--pin", p.color);
  dot.style.animationDelay = delay + "ms";
  if (p.n) dot.textContent = String(p.n);
  el.appendChild(dot);
  return el;
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
  onOpen(id: string): void;
}

export default function TripMapCanvas({ scene, frame, overview, frameKey, hot, compact, onHot, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const cb = useRef({ onHot, onOpen });
  cb.current = { onHot, onOpen };
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
      m.addSource("route", { type: "geojson", data: routeData([]) });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": T.accent, "line-width": 1.6, "line-dasharray": [2, 2.5], "line-opacity": 0 },
      });
      setReady(true);
    });
    // Only a style that never loads is fatal; a missing tile later is not.
    m.on("error", () => !loaded && setFailed("tiles"));
    // Keep the tooltip on its pin while the map moves.
    m.on("move", () => placeTip());
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
    const pins = markers.current;
    return () => {
      m.remove();
      map.current = null;
      pins.clear();
    };
    // Created once; later frames go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins and route: rebuilt when the day filter or the stops change, so the pop-in replays.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();
    scene.pins.forEach((p, i) => {
      const el = pinElement(p, p.n ? Math.min(p.n - 1, 15) * 40 : Math.min(i, 15) * 20);
      el.addEventListener("mouseenter", () => cb.current.onHot(p.id));
      el.addEventListener("mouseleave", () => cb.current.onHot(null));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onHot(null);
        cb.current.onOpen(p.id);
      });
      markers.current.set(p.id, { marker: new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(p.at).addTo(m), el });
    });

    (m.getSource("route") as GeoJSONSource | undefined)?.setData(routeData(scene.route));
    // The route fades in once the pins have popped.
    const numbered = scene.pins.filter((p) => p.n).length;
    m.setPaintProperty("route", "line-opacity-transition", { duration: 0, delay: 0 });
    m.setPaintProperty("route", "line-opacity", 0);
    const t = requestAnimationFrame(() => {
      if (!map.current) return;
      m.setPaintProperty("route", "line-opacity-transition", reducedMotion() ? { duration: 0, delay: 0 } : { duration: 400, delay: Math.min(numbered, 15) * 40 });
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

  // Hot pin (hovered here or in the side list): bigger, on top, with its tooltip.
  const hotPin = scene.pins.find((p) => p.id === hot) ?? null;
  function placeTip() {
    const m = map.current, tip = tipRef.current;
    const at = tip?.dataset.at;
    if (!m || !tip || !at) return;
    const pt = m.project(JSON.parse(at) as LngLat);
    tip.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, calc(-100% - 20px))`;
  }
  // Before paint, so the tooltip never shows a frame at the corner.
  useLayoutEffect(() => {
    markers.current.forEach(({ el }, id) => {
      const on = id === hot;
      el.toggleAttribute("data-hot", on);
      el.style.zIndex = on ? "3" : el.firstElementChild?.className === "trip-pin-n" ? "2" : "1";
    });
    placeTip();
  });

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
          data-at={JSON.stringify(hotPin.at)}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 7, background: "rgba(15,18,19,.96)", border: `1px solid ${T.border2}`, borderRadius: 9, padding: "8px 11px", maxWidth: 260, boxShadow: "0 10px 30px rgba(0,0,0,.5)", animation: "gfade 140ms ease-out" }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{(hotPin.n ? hotPin.n + ". " : "") + hotPin.title}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted2, marginTop: 3 }}>{hotPin.tip}</div>
        </div>
      )}
    </div>
  );
}
