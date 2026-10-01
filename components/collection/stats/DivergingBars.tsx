// Signed values around a center axis: positives grow right, negatives left.
// Plain props, no collection knowledge, so any card can reuse it.
import type { CSSProperties } from "react";

export interface DivergingRow {
  label: string;
  /** Display value, sign included ("+12h"). */
  val: string;
  /** Bar length as a share of the half-track ("40%"). */
  pct: string;
  neg: boolean;
}

interface Props {
  rows: DivergingRow[];
  posColor?: string;
  negColor?: string;
  /** Captions under the axis for each side, e.g. "finished faster" / "took longer". */
  negLabel?: string;
  posLabel?: string;
  labelWidth?: string;
  valWidth?: string;
}

export function DivergingBars({
  rows, posColor = "var(--accent)", negColor = "var(--muted)", negLabel, posLabel, labelWidth = "min(150px, 34%)", valWidth = "56px",
}: Props) {
  return (
    <div className="flex flex-col gap-[9px]">
      {rows.map((r, i) => {
        const bar = { width: r.pct, background: r.neg ? negColor : posColor, "--i": Math.min(i, 10) } as CSSProperties;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-none truncate text-[12.5px]" style={{ width: labelWidth }} title={r.label}>
              {r.label}
            </div>
            <div className="flex h-2 flex-1">
              <div className="flex flex-1 justify-end overflow-hidden rounded-l bg-wc">
                {r.neg && <div className="g-grow-x h-full rounded-l" style={{ ...bar, transformOrigin: "right" }} />}
              </div>
              <div className="w-px flex-none bg-wk" />
              <div className="flex-1 overflow-hidden rounded-r bg-wc">
                {!r.neg && <div className="g-grow-x h-full rounded-r" style={bar} />}
              </div>
            </div>
            <div className="flex-none text-right font-mono text-[12px] font-semibold" style={{ width: valWidth, color: r.neg ? negColor : posColor }}>
              {r.val}
            </div>
          </div>
        );
      })}
      {(negLabel || posLabel) && (
        <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-dim">
          <div className="flex-none" style={{ width: labelWidth }} />
          <div className="flex flex-1">
            <div className="flex-1 pr-2 text-right">
              {negLabel && (
                <>
                  ← <span>{negLabel}</span>
                </>
              )}
            </div>
            <div className="flex-1 pl-2">
              {posLabel && (
                <>
                  <span>{posLabel}</span> →
                </>
              )}
            </div>
          </div>
          <div className="flex-none" style={{ width: valWidth }} />
        </div>
      )}
    </div>
  );
}
