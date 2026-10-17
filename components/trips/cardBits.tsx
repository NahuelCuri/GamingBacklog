// Small read-only pieces of a card, shared by the card view, the map bubble and compare.
import { prioMeta, statusDotColor, statusMeta, type TripCard } from "@/lib/trips/model";
import { cx, tint } from "./ui";

export function Fact({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-[9px] border border-wf bg-inset px-2.5 py-2">
      <div className="mb-0.5 text-2xs font-semibold tracking-[.05em] text-muted uppercase">{label}</div>
      <div className={cx("truncate text-text", big ? "text-base font-bold" : "text-sm font-semibold")}>{value}</div>
    </div>
  );
}

export function StatusPrio({ card }: { card: TripCard }) {
  return (
    <>
      <div className="flex items-center gap-1.5 rounded-full border border-wh bg-wb px-2.5 py-1 text-xs font-semibold text-text2">
        <span aria-hidden style={tint(statusDotColor(card.status))} className="size-[7px] rounded-full bg-[var(--c)]" />
        {statusMeta(card.status).label || "—"}
      </div>
      <div className="rounded-full border border-[color-mix(in_srgb,var(--must)_30%,transparent)] bg-[color-mix(in_srgb,var(--must)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-must">
        {prioMeta(card.priority)?.label || "—"}
      </div>
    </>
  );
}

export const sourceShort = (s: string) => s.replace(/^https?:\/\//, "").replace(/\/$/, "");
