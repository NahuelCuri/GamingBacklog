"use client";

// Map tab (Wines): Argentina province map. Provinces with items glow by count;
// hover for a tooltip, click to zoom in and list the items, drag/scroll to pan
// and zoom. Drawn with d3 into a container React never re-renders.
import { geoMercator, geoPath, type GeoPath } from "d3-geo";
import { scaleSqrt } from "d3-scale";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildGeo } from "@/lib/collection";
import { AR_BOX, loadProvinces, placedTotals, provinceLabel, provinceMatcher, zoomToBounds, type Province } from "@/lib/geo/argentina";
import { useCollectionCtx } from "./CollectionContext";

interface MapHandle {
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  zoom: ZoomBehavior<SVGSVGElement, unknown>;
  path: GeoPath;
  W: number;
  H: number;
}

const overlay = "color-mix(in srgb, var(--surface) 82%, transparent)";

export function GeoMapView() {
  const { cfg, items } = useCollectionCtx();
  const geo = useMemo(() => buildGeo(cfg, items), [cfg, items]);
  const accent = cfg.theme.accent;
  const [features, setFeatures] = useState<Province[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selRegion, setSelRegion] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const mapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const selRef = useRef(selRegion);
  useEffect(() => {
    selRef.current = selRegion;
  }, [selRegion]);

  useEffect(() => {
    let live = true;
    loadProvinces().then(
      (f) => live && setFeatures(f),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  // Redraw only when the container width changes by more than 8px (legacy).
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    setWidth(w);
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      if (Math.abs(nw - w) > 8) setWidth((w = nw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hit = useMemo(() => provinceMatcher(geo.stats), [geo.stats]);
  const selected = selRegion ? (geo.stats.find((s) => s.region === selRegion) ?? null) : null;
  const totals = useMemo(() => (features ? placedTotals(features, geo.stats) : { provinces: 0, items: 0 }), [features, geo.stats]);

  const zoomTo = useCallback((f: Province) => {
    const h = handle.current;
    if (!h) return;
    const t = zoomToBounds(h.path.bounds(f), h.W, h.H);
    h.svg.transition().duration(750).call(h.zoom.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  }, []);

  const reset = useCallback(() => {
    setSelRegion(null);
    const h = handle.current;
    if (h) h.svg.transition().duration(600).call(h.zoom.transform, zoomIdentity);
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || !features) return;
    el.replaceChildren();
    const W = el.clientWidth || 900, H = el.clientHeight || 620;
    const proj = geoMercator().fitSize([W, H], AR_BOX);
    const path = geoPath(proj);

    const counts = features.map((f) => hit(f)?.count ?? 0).filter(Boolean);
    const opa = scaleSqrt().domain([0, Math.max(1, ...counts)]).range([0.28, 0.72]);
    const pOpa = (f: Province) => {
      const s = hit(f);
      return s ? opa(s.count) : 1;
    };

    const tip = tipRef.current!;
    const hideTip = () => (tip.style.display = "none");
    const showTip = (e: MouseEvent, name: string, count: number) => {
      const r = el.getBoundingClientRect();
      tip.style.display = "block";
      tip.style.left = e.clientX - r.left + "px";
      tip.style.top = e.clientY - r.top + "px";
      tip.children[0].textContent = name;
      tip.children[1].textContent = `${count} ${geo.noun}`;
    };

    const svg = select(el)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", `${geo.title}: map of Argentina`)
      .style("display", "block");
    const g = svg.append("g").style("will-change", "transform");

    g.selectAll<SVGPathElement, Province>("path.prov")
      .data(features)
      .join("path")
      .attr("class", "prov")
      .attr("d", (f) => path(f))
      .attr("fill", (f) => (hit(f) ? accent : "var(--wa)"))
      .attr("fill-opacity", pOpa)
      .attr("stroke", (f) => (hit(f) ? accent : "var(--wj)"))
      .attr("stroke-width", (f) => (hit(f) ? 1.1 : 0.55))
      .attr("stroke-linejoin", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .style("cursor", (f) => (hit(f) ? "pointer" : "default"))
      .style("transition", "fill-opacity .15s ease")
      .on("mousemove", function (e: MouseEvent, f) {
        const s = hit(f);
        if (!s) return hideTip();
        select(this).attr("fill-opacity", 0.85);
        showTip(e, provinceLabel(f), s.count);
      })
      .on("mouseleave", function (_e, f) {
        hideTip();
        select(this).attr("fill-opacity", pOpa(f));
      })
      .on("click", (_e, f) => {
        const s = hit(f);
        if (!s) return;
        hideTip();
        setSelRegion(s.region);
        zoomTo(f);
      });

    const labels = g.append("g").style("opacity", 0).style("pointer-events", "none");
    labels
      .selectAll<SVGTextElement, Province>("text")
      .data(features)
      .join("text")
      .attr("transform", (f) => {
        const [x, y] = path.centroid(f);
        return `translate(${x},${y})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.32em")
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .attr("font-weight", (f) => (hit(f) ? 600 : 400))
      .attr("fill", (f) => (hit(f) ? "var(--text)" : "var(--muted)"))
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(0,0,0,0.6)")
      .attr("stroke-width", 2.6)
      .attr("stroke-linejoin", "round")
      .text(provinceLabel);

    // Labels toggle only when crossing the threshold and resize at rest, never
    // on every wheel tick (per-frame updates were legacy's main stutter).
    let shown = false;
    let sizeT: ReturnType<typeof setTimeout> | undefined;
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [W, H]]) // = the viewBox, d3's default (spelled out for jsdom)
      .scaleExtent([1, 14])
      .on("zoom", (e) => {
        const k = e.transform.k;
        g.attr("transform", e.transform.toString());
        if (resetRef.current) resetRef.current.style.display = k > 1.02 ? "block" : "none";
        if (hintRef.current) hintRef.current.style.opacity = k > 1.25 ? "0" : "1";
        const show = k > 1.6;
        if (show !== shown) {
          shown = show;
          labels.style("opacity", show ? 1 : 0);
        }
        if (show) {
          clearTimeout(sizeT);
          sizeT = setTimeout(() => labels.selectAll("text").attr("font-size", Math.max(6, Math.min(13, 11 / k))), 90);
        }
      });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("dblclick", reset);

    handle.current = { svg, zoom, path, W, H };

    // Keep a selected province framed after a redraw.
    const sel = selRef.current;
    const f = sel && features.find((x) => hit(x)?.region === sel);
    if (f) zoomTo(f);

    return () => {
      clearTimeout(sizeT);
      svg.interrupt().on(".zoom", null);
      handle.current = null;
    };
  }, [features, hit, accent, geo.noun, geo.title, width, zoomTo, reset]);

  return (
    <div className="pt-[22px]" style={{ animation: "gfade .2s ease" }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[17px] font-semibold tracking-[-.01em] text-text2">{geo.title}</div>
          <div className="mt-1 max-w-[540px] text-[12.5px] text-muted [text-wrap:pretty]">{geo.subtitle}</div>
        </div>
        <div className="flex gap-4 font-mono text-xs text-dim">
          <div>
            <span className="font-semibold text-accent">{totals.provinces}</span> provinces
          </div>
          <div>
            <span className="font-semibold text-text3">{totals.items}</span> {geo.noun}
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-[14px] border border-we"
        style={{ background: "radial-gradient(130% 130% at 50% -10%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 55%), var(--inset)" }}
      >
        <div ref={mapRef} data-testid="geo-map" className="w-full cursor-grab" style={{ height: "clamp(420px, 72vh, 720px)" }} />

        {!features && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-xs text-dim">
            {failed ? "map unavailable (offline)" : "loading map…"}
          </div>
        )}

        <div
          ref={hintRef}
          className="pointer-events-none absolute bottom-3 left-3 rounded-[7px] border border-wd px-[9px] py-[5px] font-mono text-[10.5px] text-dim"
          style={{ background: "color-mix(in srgb, var(--surface) 70%, transparent)" }}
        >
          drag to pan · scroll to zoom · click a province
        </div>

        <button
          ref={resetRef}
          type="button"
          onClick={reset}
          className="absolute right-3 top-3 z-[7] hidden cursor-pointer rounded-lg border border-wg px-[11px] py-1.5 font-mono text-[11px] text-muted backdrop-blur-[6px]"
          style={{ background: overlay }}
        >
          reset view
        </button>

        <div
          ref={tipRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-[8] hidden whitespace-nowrap rounded-[9px] border border-wh px-[11px] py-[7px] backdrop-blur-[8px]"
          style={{ transform: "translate(-50%,-135%)", background: "color-mix(in srgb, var(--surface) 92%, transparent)", boxShadow: "0 8px 24px rgba(0,0,0,.45)" }}
        >
          <div className="text-[13px] font-semibold text-text" />
          <div className="mt-[2px] font-mono text-[11px]" style={{ color: accent }} />
        </div>

        {selected && (
          <div
            className="absolute bottom-0 right-0 top-0 z-[9] overflow-y-auto border-l border-wf px-5 pb-6 pt-5 backdrop-blur-[12px]"
            style={{ width: "min(300px, 80%)", background: "color-mix(in srgb, var(--card) 95%, transparent)", animation: "gslide .22s ease" }}
          >
            <div className="mb-[15px] flex items-start justify-between gap-2.5">
              <div>
                <div className="text-[16.5px] font-semibold tracking-[-.01em] text-text">{selected.region}</div>
                <div className="mt-1 font-mono text-xs text-accent">
                  {selected.count} {geo.noun}
                </div>
              </div>
              <button type="button" onClick={reset} aria-label="Clear region selection" className="cursor-pointer border-none bg-transparent px-1.5 py-0.5 text-[19px] leading-none text-muted">
                ×
              </button>
            </div>
            <div className="mb-1.5 h-px bg-we" />
            {selected.items.map((it, i) => (
              <div key={i} className="border-b border-wc py-[9px] text-[13px] text-text2 [text-wrap:pretty]">
                {it}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
