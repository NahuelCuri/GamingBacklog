"use client";

// Shared layout for the two share dialogs: a controls panel beside a live
// preview that is rasterized to PNG on copy / download.
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { useDialog } from "@/lib/hooks/useDialog";
import { copyImage, downloadImage, renderPng } from "@/lib/image-export";

export const eyebrow = "text-[10px] font-semibold tracking-[.09em] text-dim uppercase";
export const textInput = "w-full rounded-[9px] border border-wh bg-inset px-3 py-[9px] text-[13.5px] text-text";

export function ShareShell({
  label,
  subtitle,
  width,
  zIndex,
  onClose,
  controls,
  preview,
  previewRef,
  pixelRatio,
  fileName,
  shareTitle,
  canCopy,
}: {
  label: string;
  subtitle: string;
  width: number;
  zIndex: number;
  onClose(): void;
  controls: ReactNode;
  preview: ReactNode;
  previewRef: RefObject<HTMLDivElement | null>;
  pixelRatio: number;
  fileName: string;
  shareTitle: string;
  canCopy: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialog(dialog, onClose, false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const render = () => {
    const node = previewRef.current;
    if (!node) return Promise.reject(new Error("render failed"));
    return renderPng(node, pixelRatio);
  };
  const run = async (op: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    setMsg(await op());
    setBusy(false);
  };

  return (
    <div
      onClick={onClose}
      className="g-scroll fixed inset-0 flex items-start justify-center overflow-auto overscroll-contain px-5 py-10 backdrop-blur-[4px]"
      style={{ zIndex, background: "rgba(6,7,7,.8)" }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-full flex-wrap items-start gap-[22px] outline-none"
        style={{ width, animation: "gpop .2s ease" }}
      >
        <div className="min-w-[280px] flex-1 rounded-2xl border border-wg bg-card px-[22px] pt-[22px] pb-5">
          <div className="mb-[3px] flex items-center justify-between">
            <span className="text-base font-bold">{label}</span>
            <button type="button" onClick={onClose} aria-label="Close dialog" className="cursor-pointer border-none bg-transparent px-1 text-xl leading-none text-muted">
              ×
            </button>
          </div>
          <div className="mb-[18px] text-[12.5px] text-muted">{subtitle}</div>
          {controls}
          <div className="flex gap-[9px]">
            <button
              type="button"
              aria-busy={busy}
              disabled={busy || !canCopy}
              onClick={() => run(() => copyImage(render, fileName, shareTitle))}
              className="flex-1 cursor-pointer rounded-[9px] border-none bg-accent p-[11px] text-[13px] font-bold text-on-accent disabled:cursor-not-allowed"
              style={{ opacity: busy || !canCopy ? 0.5 : 1 }}
            >
              {busy ? "Rendering…" : "Copy image"}
            </button>
            <button
              type="button"
              aria-busy={busy}
              onClick={() => run(() => downloadImage(render, fileName))}
              className="cursor-pointer rounded-[9px] border border-wf bg-chip px-4 py-[11px] text-[13px] font-semibold text-text2"
            >
              Download
            </button>
          </div>
          <div aria-live="polite" className="mt-[11px] text-center text-xs text-muted">
            {msg}
          </div>
        </div>
        <div className="g-scroll max-w-full flex-none overflow-auto">{preview}</div>
      </div>
    </div>
  );
}

/** Toggle pill with a ✓ / + mark (module and field pickers). */
export function TogglePill({ on, label, onClick }: { on: boolean; label: string; onClick(): void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-medium"
      style={on ? { color: "var(--onAccent)", background: "var(--accent)", borderColor: "var(--accent)" } : { color: "var(--text2)", background: "var(--chip)", borderColor: "var(--wf)" }}
    >
      {label}{" "}
      <span aria-hidden className="font-mono text-[11px] opacity-75">
        {on ? "✓" : "+"}
      </span>
    </button>
  );
}
