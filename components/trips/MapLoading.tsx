import { PinIcon } from "@/components/icons";

/** What the map area shows while MapLibre and its first tiles load (the basemap is dark in either theme). */
export function MapLoading() {
  return (
    <div role="status" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0c0d] [background-image:radial-gradient(circle_at_1px_1px,#161c1e_1px,transparent_0)] [background-size:26px_26px]">
      <span className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-[#14181a] text-[#5fb8b0] [animation:gpulse_1.4s_ease-in-out_infinite]">
        <PinIcon size={20} />
      </span>
      <span className="text-xs font-medium text-[#9aa7a4]">Loading map…</span>
    </div>
  );
}
