import type { LookalikeWhy, TripCard } from "@/lib/trips/model";
import { cx } from "./ui";

/**
 * Cards already in the trip that the one being written may repeat. A heads-up,
 * never a block: two visits to the same place can be on purpose.
 */
export function LookalikeNote({ found, hint, onOpen, className }: { found: { card: TripCard; why: LookalikeWhy }[]; hint?: string; onOpen?(id: string): void; className?: string }) {
  if (!found.length) return null;
  return (
    <div role="status" className={cx("rounded-lg border border-[color-mix(in_srgb,var(--must)_28%,transparent)] bg-[color-mix(in_srgb,var(--must)_8%,transparent)] px-2.5 py-2 text-xs leading-[1.45] text-must", className)}>
      <div className="mb-1">{found.length > 1 ? "Looks like cards you already have:" : "Looks like a card you already have:"}</div>
      {found.map(({ card, why }) => (
        <div key={card.id} className="flex min-w-0 items-baseline gap-1.5">
          <span className="min-w-0 truncate font-semibold text-text2">{card.title || "Untitled"}</span>
          <span className="shrink-0 font-mono text-2xs text-muted">
            {why} · {card.day != null ? "Day " + card.day : "pool"}
          </span>
          {onOpen && (
            <button type="button" onClick={() => onOpen(card.id)} className="ml-auto shrink-0 cursor-pointer text-2xs font-semibold text-accent2 underline-offset-2 hover:underline">
              edit that one
            </button>
          )}
        </div>
      ))}
      {hint && <div className="mt-1 text-muted">{hint}</div>}
    </div>
  );
}
