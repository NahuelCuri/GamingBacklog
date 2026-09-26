"use client";

// Shared layout for the two share dialogs: a controls panel beside a live
// preview that is rasterized to PNG on copy / download.
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { CloseIcon } from "@/components/icons";
import { accentButton, closeButton, neutralButton, toggleChip } from "@/components/ui/Pills";
import { useDialog } from "@/lib/hooks/useDialog";
import { copyImage, downloadImage, renderPng } from "@/lib/image-export";

export const eyebrow = "text-[10px] font-semibold tracking-[.09em] text-dim uppercase";
export const textInput = "w-full rounded-[9px] border border-wh bg-inset px-3 py-[9px] text-[13.5px] text-text";

export function ShareShell({
  label,
  subtitle,
  width,
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
      style={{ zIndex: "var(--z-dialog)", background: "rgba(6,7,7,.8)" }}
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
            <button type="button" onClick={onClose} aria-label="Close dialog" className={closeButton + " -mr-2"}>
              <CloseIcon size={15} />
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
              className={accentButton + " flex-1 p-[11px] text-[13px] font-bold"}
            >
              {busy ? "Rendering…" : "Copy image"}
            </button>
            <button
              type="button"
              aria-busy={busy}
              onClick={() => run(() => downloadImage(render, fileName))}
              className={neutralButton + " px-4 py-[11px] text-[13px]"}
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
      className={toggleChip(on) + " flex items-center gap-1.5 rounded-[20px] px-[13px] py-[7px] text-[12.5px] font-medium"}
    >
      {label}{" "}
      <span aria-hidden className="font-mono text-[11px] opacity-75">
        {on ? "✓" : "+"}
      </span>
    </button>
  );
}
