import type { CSSProperties } from "react";
import type { LookalikeWhy, TripCard } from "@/lib/trips/model";
import { T } from "./styles";

/**
 * Cards already in the trip that the one being written may repeat. A heads-up,
 * never a block: two visits to the same place can be on purpose.
 */
export function LookalikeNote({ found, hint, onOpen, style }: { found: { card: TripCard; why: LookalikeWhy }[]; hint?: string; onOpen?(id: string): void; style?: CSSProperties }) {
  if (!found.length) return null;
  return (
    <div role="status" style={{ fontSize: 11.5, lineHeight: 1.45, color: "#d9b07c", background: "rgba(224,168,107,.07)", border: "1px solid rgba(224,168,107,.22)", borderRadius: 8, padding: "7px 10px", ...style }}>
      <div style={{ marginBottom: 3 }}>{found.length > 1 ? "Looks like cards you already have:" : "Looks like a card you already have:"}</div>
      {found.map(({ card, why }) => (
        <div key={card.id} style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{card.title || "Untitled"}</span>
          <span style={{ flex: "0 0 auto", fontFamily: T.mono, fontSize: 10.5, color: T.dim2 }}>
            {why} · {card.day != null ? "Day " + card.day : "pool"}
          </span>
          {onOpen && (
            <button type="button" onClick={() => onOpen(card.id)} style={{ flex: "0 0 auto", marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 11, fontWeight: 600, color: "#9fd8d1", background: "none", border: "none", padding: 0 }}>
              edit that one
            </button>
          )}
        </div>
      ))}
      {hint && <div style={{ marginTop: 4, color: T.dim2 }}>{hint}</div>}
    </div>
  );
}
