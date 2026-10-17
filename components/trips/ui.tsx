"use client";

// Trip Planner building blocks: buttons, chips, labels and fields on the shared
// theme tokens (globals.css), so the planner follows the light theme too.
// Category colours (card types, statuses) come in as --c and are drawn with
// .tp-ink, which darkens them on a light page.
import { forwardRef, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type RefObject } from "react";
import { useDialog } from "@/lib/hooks/useDialog";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** `--c` for a category colour, merged into an element's style. */
export const tint = (color: string | undefined, style?: CSSProperties): CSSProperties => ({ ...style, ...(color ? { ["--c" as string]: color } : {}) });

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "dangerSolid";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent font-bold hover:brightness-110 shadow-[0_4px_16px_color-mix(in_srgb,var(--accent)_22%,transparent)]",
  secondary: "border border-wh bg-surface text-text2 font-semibold hover:border-wl hover:text-text",
  ghost: "text-muted font-semibold hover:bg-wc hover:text-text",
  soft: "border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent2 font-semibold hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
  danger: "border border-[color-mix(in_srgb,var(--neg)_35%,transparent)] text-neg font-semibold hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)]",
  dangerSolid: "bg-neg text-white font-bold hover:brightness-110",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg pointer-coarse:h-10",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px] pointer-coarse:h-11",
};

const PRESS = "cursor-pointer transition-[background-color,border-color,color,filter,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", className, type = "button", ...p }, ref) {
  return <button ref={ref} type={type} className={cx("inline-flex shrink-0 items-center justify-center whitespace-nowrap", PRESS, SIZE[size], VARIANT[variant], className)} {...p} />;
});

/** A square icon button. It needs an aria-label; 32px with a mouse, 44px on touch screens. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string; tone?: "plain" | "framed" | "onImage" }>(function IconButton(
  { tone = "plain", className, type = "button", ...p },
  ref,
) {
  const look = {
    plain: "text-muted hover:bg-wc hover:text-text",
    framed: "border border-wh bg-surface text-muted hover:border-wl hover:text-text",
    onImage: "bg-black/35 text-white backdrop-blur-[3px] hover:bg-black/50",
  }[tone];
  return <button ref={ref} type={type} className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11", PRESS, look, className)} {...p} />;
});

/** A toggle pill (filters, type and status pickers): filled with its colour when on. */
export function Chip({ on, color, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      style={tint(color, p.style)}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold",
        PRESS,
        on ? "border-transparent bg-[var(--c,var(--accent))] text-on-accent" : cx("border-wh hover:border-wl", color ? "tp-ink" : "text-muted hover:text-text"),
        className,
      )}
      {...p}
    >
      {children}
    </button>
  );
}

/** Small mono uppercase label: dialog kickers, section heads. */
export function Kicker({ className, children, as: Tag = "div" }: { className?: string; children: ReactNode; as?: "div" | "h2" | "h3" | "span" }) {
  return <Tag className={cx("m-0 font-mono text-2xs font-medium uppercase tracking-[.1em] text-muted", className)}>{children}</Tag>;
}

/** A card type ("FOOD", "PLACE"…) in its colour. */
export function TypeLabel({ color, children, icon, className }: { color: string; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span style={tint(color)} className={cx("tp-ink inline-flex items-center gap-1 font-mono text-2xs font-semibold uppercase tracking-[.06em]", className)}>
      {icon}
      {children}
    </span>
  );
}

export function FieldLabel({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("mb-1.5 block text-xs font-semibold text-muted", className)}>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-[9px] border border-wh bg-inset px-3 py-2.5 text-13 text-text outline-none transition-colors placeholder:text-dim hover:border-wl";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...p} />;
});

/** A tag as a pill. */
export const tagCls = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2.5 py-1 text-xs text-accent2";

/**
 * A small panel of choices: a bottom sheet on phones, a popover beside its
 * button elsewhere. Modal either way (focus stays in, Escape closes).
 */
export function Sheet({ label, anchor, mobile, onClose, children, width = 260 }: { label: string; anchor: RefObject<HTMLElement | null>; mobile: boolean; onClose(): void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose, false);
  const [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (mobile) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 0;
      if (!r) return;
      const left = Math.min(Math.max(8, r.right - width), innerWidth - width - 8);
      const up = r.bottom + 6 + h > innerHeight - 8 && r.top - 6 - h > 8;
      setAt({ left, top: up ? r.top - 6 - h : r.bottom + 6, up });
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [mobile, anchor, width]);
  return (
    <div className={cx("fixed inset-0 z-[var(--z-overlay)]", mobile && "bg-black/50 backdrop-blur-[2px] [animation:gfade_160ms_ease-out]")} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={mobile ? undefined : { position: "fixed", width, left: at?.left ?? -9999, top: at?.top ?? 0, transformOrigin: at?.up ? "bottom right" : "top right" }}
        className={cx(
          "border border-wh bg-surface shadow-[var(--shadow-pop)] outline-none",
          mobile
            ? "absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] [animation:drawerRise_260ms_var(--ease-out)]"
            : "max-h-[70vh] overflow-y-auto rounded-xl p-1.5 [animation:dpop_160ms_var(--ease-out)]",
        )}
      >
        {mobile && <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-wk" />}
        {children}
      </div>
    </div>
  );
}

/** A row in a Sheet. */
export function SheetItem({ on, disabled, danger, onClick, children, hint }: { on?: boolean; disabled?: boolean; danger?: boolean; onClick(): void; children: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={on || undefined}
      className={cx(
        "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm pointer-coarse:min-h-12",
        PRESS,
        on ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-semibold text-accent2" : danger ? "font-semibold text-neg hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)]" : "text-text2 hover:bg-wc",
        "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
      )}
    >
      <span className="flex-1">{children}</span>
      {hint && <span className="font-mono text-2xs text-muted">{hint}</span>}
    </button>
  );
}
