"use client";

// Add / edit form, generated from cfg.modal.groups. Conditional groups slide
// open and closed; hiding a group blanks its fields.
import { useRef, type Dispatch, type SetStateAction } from "react";
import { CloseIcon } from "@/components/icons";
import { DatePicker } from "@/components/ui/DatePicker";
import { accentButton, closeButton, dangerButton, neutralButton, toggleChip } from "@/components/ui/Pills";
import {
  comboSuggestions, enumNext, fieldsHiddenBy, findDuplicate, groupVisible, isDraftValid, itemFromDraft, tagInputKey,
  tagSuggestions, withTag, withoutTag, type Draft,
} from "@/lib/collection";
import type { Item, ModalField } from "@/lib/collection/types";
import { useDialog } from "@/lib/hooks/useDialog";
import { applyLookup, cleanIsbn, lookupIsbn } from "@/lib/lookup";
import { useCollectionCtx } from "./CollectionContext";

export interface ModalState {
  mode: "add" | "edit";
  draft: Draft;
  lookup?: "loading" | "done" | "error";
  lookupMsg?: string;
  confirmDel?: boolean;
}

const label = "mb-[7px] text-[11px] font-semibold tracking-[.06em] text-muted uppercase";
const input = "w-full rounded-[9px] border border-wh bg-inset px-3 py-2.5 text-sm text-text";
const chipBtn =
  "cursor-pointer rounded-[20px] border border-wd bg-chip px-2.5 py-1 text-[11.5px] text-muted2 transition-[color,border-color] duration-150 hover:border-wi hover:text-text";

export function ItemModal({
  modal,
  setModal,
  onClose,
}: {
  modal: ModalState;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  onClose(): void;
}) {
  const { cfg, items, actions, isMobile, openShare } = useCollectionCtx();
  const dialog = useRef<HTMLDivElement>(null);
  useDialog(dialog, onClose);

  const { draft } = modal;
  const titleKey = cfg.modal.titleField;
  const valid = isDraftValid(cfg, draft);
  const isEdit = modal.mode === "edit";

  const patch = (fields: Record<string, unknown>) => setModal((m) => (m ? { ...m, draft: { ...m.draft, ...fields } } : m));
  const set = (key: string, v: unknown) => patch({ [key]: v });
  /** Set a field and blank the fields of any conditional group it now hides. */
  const setGated = (key: string, v: unknown) =>
    setModal((m) => {
      if (!m) return m;
      const cleared = Object.fromEntries(fieldsHiddenBy(cfg, m.draft, key, v).map((k) => [k, ""]));
      return { ...m, draft: { ...m.draft, [key]: v, ...cleared } };
    });

  const save = () => {
    if (!valid || !actions) return;
    actions.save(itemFromDraft(cfg, draft));
    onClose();
  };
  const del = () => {
    if (!modal.confirmDel) return setModal((m) => (m ? { ...m, confirmDel: true } : m));
    if (draft.id) actions?.remove(draft.id);
    onClose();
  };

  const runLookup = async (f: ModalField) => {
    if (modal.lookup === "loading" || !f.lookup) return;
    const isbn = cleanIsbn(draft[f.key]);
    if (!isbn) return setModal((m) => m && { ...m, lookup: "error", lookupMsg: "Enter an ISBN first" });
    setModal((m) => m && { ...m, lookup: "loading", lookupMsg: "Looking up…" });
    let info = null;
    try {
      info = await lookupIsbn(isbn);
    } catch {
      return setModal((m) => m && { ...m, lookup: "error", lookupMsg: "Lookup failed — check your connection" });
    }
    if (!info) {
      return setModal(
        (m) => m && { ...m, lookup: "error", lookupMsg: "No catalog has this ISBN (common for non-English ebooks) — fill it in manually." },
      );
    }
    const fill = f.lookup.fill;
    setModal((m) => {
      if (!m) return m;
      const { draft: d, filled } = applyLookup(m.draft, fill, info);
      return { ...m, draft: d, lookup: "done", lookupMsg: filled.length ? "Filled: " + filled.join(", ") : "Found, but no new fields to fill" };
    });
  };

  const renderField = (f: ModalField) => {
    const v = draft[f.key];
    switch (f.kind) {
      case "text":
      case "number": {
        const mono = f.kind === "number";
        const dup = f.dupCheck ? findDuplicate(cfg, items, draft) : null;
        return (
          <>
            <div className={label}>{f.label}</div>
            {f.lookup ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    className={input + " min-w-0 flex-1"}
                    value={String(v ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                    aria-label={f.label}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={f.placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => runLookup(f)}
                    className="flex-none cursor-pointer rounded-[9px] border px-[14px] py-2.5 text-xs font-semibold whitespace-nowrap text-accent transition-[filter,transform] duration-200 hover:brightness-125 active:translate-y-px"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      borderColor: "color-mix(in srgb, var(--accent) 32%, transparent)",
                      opacity: modal.lookup === "loading" ? 0.55 : 1,
                    }}
                  >
                    {modal.lookup === "loading" ? "Looking up…" : "Auto-fill from ISBN"}
                  </button>
                </div>
                {modal.lookupMsg && (
                  <div
                    className="mt-1.5 text-xs leading-[1.4]"
                    style={{ color: modal.lookup === "error" ? "var(--neg)" : modal.lookup === "done" ? "var(--accent)" : "var(--muted)" }}
                  >
                    {modal.lookupMsg}{" "}
                    {modal.lookup === "error" && (
                      <a
                        href={"https://www.google.com/search?q=" + encodeURIComponent((String(draft[titleKey] || "") + " " + String(v || "")).trim() + " book")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline"
                      >
                        Search the web ↗
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <input
                className={input + (mono ? " font-mono" : "")}
                type={mono ? "number" : "text"}
                value={String(v ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
                aria-label={f.label}
                autoComplete="off"
                min={f.min}
                max={f.max}
                step={f.step}
                placeholder={f.placeholder}
              />
            )}
            {dup && (
              <div className="mt-[7px] flex items-center gap-1.5 text-xs leading-[1.5] text-[#e0b86a]">
                <span aria-hidden>⚠</span>“{String(dup[titleKey])}” is already in your backlog.
              </div>
            )}
          </>
        );
      }
      case "date":
        return (
          <>
            <div className={label}>{f.label}</div>
            <DatePicker value={String(v ?? "")} placeholder={f.placeholder || f.label} onChange={(iso) => set(f.key, iso)} />
          </>
        );
      case "longtext":
        return (
          <>
            <div className={label}>{f.label}</div>
            <textarea
              className={input + " min-h-[88px] resize-y text-[13.5px] leading-[1.55]"}
              value={String(v ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              aria-label={f.label}
              placeholder={f.placeholder}
            />
          </>
        );
      case "tags": {
        const tags = (v as string[]) || [];
        const tiKey = tagInputKey(f.key);
        const suggest = tagSuggestions(items, f.key, draft);
        return (
          <>
            <div className={label}>{f.label}</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={"Remove tag " + t}
                  onClick={() => setModal((m) => m && { ...m, draft: withoutTag(m.draft, f.key, t) })}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border px-2.5 py-[5px] text-xs text-accent transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[.97]"
                  style={{ background: "color-mix(in srgb, var(--accent) 13%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
                >
                  {t}{" "}
                  <span aria-hidden className="text-[13px] leading-none">
                    ×
                  </span>
                </button>
              ))}
            </div>
            <input
              className={input + " py-[9px] text-[13px]"}
              value={String(draft[tiKey] ?? "")}
              onChange={(e) => set(tiKey, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  setModal((m) => m && { ...m, draft: withTag(m.draft, f.key, m.draft[tiKey]) });
                }
              }}
              aria-label={f.label + " — add a tag"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Type a tag, press Enter…"
            />
            {suggest.length > 0 && (
              <div className="mt-[9px] flex flex-wrap gap-1.5">
                {suggest.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={"Add tag " + t}
                    onClick={() => setModal((m) => m && { ...m, draft: withTag(m.draft, f.key, t) })}
                    className={chipBtn}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </>
        );
      }
      case "status":
      case "enum": {
        const options = f.kind === "status" ? cfg.statuses.map((s) => ({ value: s.value, label: s.label })) : (f.options || []).map((o) => ({ value: o, label: o }));
        return (
          <>
            <div className={label}>{f.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => {
                const on = v === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGated(f.key, f.kind === "status" ? o.value : enumNext(v, o.value))}
                    className={toggleChip(on, "border-wd bg-chip text-muted") + " min-w-[74px] flex-1 rounded-[9px] px-1.5 py-[9px] text-center text-[13px] font-medium"}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      }
      case "combo": {
        const suggest = comboSuggestions(items, f, v);
        return (
          <>
            <div className={label}>{f.label}</div>
            <input
              className={input}
              value={String(v ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              aria-label={f.label}
              autoComplete="off"
              spellCheck={false}
              placeholder={f.placeholder}
            />
            {suggest.length > 0 && (
              <div className="mt-[9px] flex flex-wrap gap-1.5">
                {suggest.map((s) => (
                  <button key={s} type="button" onClick={() => set(f.key, s)} className={chipBtn}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        );
      }
      case "toggle": {
        const on = !!v;
        return (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => set(f.key, !on)}
            className="flex cursor-pointer items-center gap-[9px] border-none bg-transparent px-1 py-[2px] text-inherit"
          >
            <span aria-hidden className="relative h-[22px] w-[38px] flex-none rounded-xl transition-[background] duration-200" style={{ background: on ? f.onColor || "var(--accent)" : "var(--chip)" }}>
              <span className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-text transition-[left] duration-200" style={{ left: on ? 18 : 2 }} />
            </span>
            <span className="text-[13px] text-text2">{f.label}</span>
          </button>
        );
      }
    }
  };

  const title = (isEdit ? "Edit " : "Add ") + cfg.noun;
  const cols = (n: number) => (isMobile ? "1fr" : n === 3 ? "1fr 1fr 1fr" : n === 2 ? "1fr 1fr" : "1fr");

  return (
    <div
      onClick={onClose}
      className="g-scroll fixed inset-0 z-(--z-overlay) flex items-start justify-center overflow-auto overscroll-contain px-5 py-12 backdrop-blur-[3px]"
      style={{ background: "rgba(6,7,7,.72)" }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-full rounded-2xl border border-wg bg-card outline-none"
        style={{ boxShadow: "var(--shadow-pop)", animation: "gpop .2s ease" }}
      >
        <div className="flex items-center justify-between border-b border-wd px-6 py-5">
          <span className="text-base font-bold">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close dialog" className={closeButton + " -mr-2"}>
            <CloseIcon size={15} />
          </button>
        </div>
        <div className="flex flex-col gap-[17px] px-6 py-[22px]">
          {cfg.modal.groups.map((gr, i) => {
            const shown = groupVisible(gr, draft);
            return (
              <div
                key={i}
                className="grid"
                style={{
                  gridTemplateRows: shown ? "1fr" : "0fr",
                  opacity: shown ? 1 : 0,
                  marginTop: gr.showWhen && !shown ? -17 : 0,
                  transition: "grid-template-rows .32s cubic-bezier(.4,0,.2,1), opacity .28s ease, margin-top .32s cubic-bezier(.4,0,.2,1)",
                }}
              >
                <div className="min-h-0" style={{ overflow: gr.showWhen ? "hidden" : "visible" }} inert={!shown}>
                  <div className="grid gap-[14px]" style={{ gridTemplateColumns: cols(gr.cols) }}>
                    {gr.fields.map((f) => (
                      <div key={f.key}>{renderField(f)}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-wd px-6 py-4">
          {isEdit ? (
            <button
              type="button"
              onClick={del}
              className={dangerButton(!!modal.confirmDel) + " rounded-[9px] px-4 py-[9px] text-[13px]"}
            >
              {modal.confirmDel ? "Confirm delete" : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-[9px]">
            {isEdit && (
              <button
                type="button"
                onClick={() => openShare(itemFromDraft(cfg, draft) as Item)}
                className={neutralButton + " px-4 py-[9px] text-[13px]"}
              >
                Share
              </button>
            )}
            <button type="button" onClick={onClose} className={neutralButton + " px-[18px] py-[9px] text-[13px]"}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              aria-disabled={!valid}
              className={accentButton + " px-[22px] py-[9px] text-[13px] font-bold"}
            >
              {isEdit ? "Save" : cfg.addLabel.replace("+ ", "")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
