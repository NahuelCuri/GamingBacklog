"use client";

// Trip Planner dialogs: read-only card view, card editor, trip editor, the
// type-the-name delete confirmation and who a trip is shared with.
import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowUpRightIcon, CloseIcon, PinIcon } from "@/components/icons";
import { DatePicker } from "@/components/ui/DatePicker";
import { useDialog } from "@/lib/hooks/useDialog";
import {
  PRIOS, STATUSES, TYPES, addTag, byNearness, dayHint, locQuery, locStatus, locStr, lookalikes, money, parseLoc, pickPlace, regionFromAddress, regionSuggestions, reverseUrl, tagSuggestions, tripArea, typeMeta, type Place, type Trip, type TripCard,
} from "@/lib/trips/model";
import { searchPlaces, tripCountries } from "@/lib/trips/places";
import type { ShareResult } from "@/lib/trips/store";
import { Fact, StatusPrio, sourceShort } from "./cardBits";
import { LookalikeNote } from "./LookalikeNote";
import { useTripCtx, type CardModal, type TripAccess, type TripModal } from "./TripPlanner";
import { Button, Chip, FieldLabel, IconButton, Kicker, TypeLabel, cx, inputCls, tagCls, tint } from "./ui";

function Dialog({ label, onClose, children, accent, narrow, top }: { label: string; onClose(): void; children: ReactNode; accent?: string; narrow?: boolean; top?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div onClick={onClose} className={cx("fixed inset-0 flex items-end justify-center overscroll-contain bg-black/60 backdrop-blur-[3px] [animation:gfade_160ms_ease-out] tp:items-center tp:p-6", top ? "z-[var(--z-dialog)]" : "z-[var(--z-overlay)]")}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={tint(accent)}
        className={cx(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-wh bg-surface shadow-[var(--shadow-pop)] outline-none [animation:gpop_220ms_var(--ease-out)] tp:max-h-[88vh] tp:rounded-2xl",
          accent && "border-t-[3px] border-t-[var(--c)]",
          narrow ? "tp:max-w-[400px]" : "tp:max-w-[460px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Head({ children, onClose }: { children: ReactNode; onClose(): void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-wf py-2.5 pr-2.5 pl-[18px]">
      {children}
      <IconButton onClick={onClose} aria-label="Close">
        <CloseIcon size={15} />
      </IconButton>
    </div>
  );
}

function Foot({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex shrink-0 items-center justify-between gap-2 border-t border-wf px-[18px] py-3 pb-[max(12px,env(safe-area-inset-bottom))]", className)}>{children}</div>;
}

const body = "g-scroll min-h-0 flex-1 overflow-y-auto p-[18px]";

// ---------------------------------------------------------------- view

/** What a card says, read-only: the view dialog's body, and the map's opened bubble. */
export function CardViewBody({ card: d }: { card: TripCard }) {
  const { trip } = useTripCtx();
  const tags = d.tags || [];
  const hasPrice = d.price != null && (d.price as unknown) !== "";
  return (
    <>
      <div className="mb-3 text-xl leading-[1.25] font-extrabold tracking-[-.01em] text-text">{d.title || "Untitled"}</div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <StatusPrio card={d} />
        <div className="rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1 font-mono text-2xs font-semibold text-accent2">
          {d.day != null ? "Day " + d.day + (trip ? " · " + dayHint(trip, d.day) : "") : "Pool"}
        </div>
      </div>
      {(hasPrice || d.startTime || d.duration) && (
        <div className="mb-4 flex gap-2">
          {hasPrice && <Fact label="Price" value={money(d.price, trip?.currency)} big />}
          {d.startTime && <Fact label="Start" value={d.startTime} />}
          {d.duration && <Fact label="Duration" value={d.duration} />}
        </div>
      )}
      {d.region && (
        <div className="mb-4 flex items-center gap-1.5 text-13 text-text2">
          <span className="text-accent">
            <PinIcon size={13} />
          </span>
          {d.region}
        </div>
      )}
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span key={i} className={tagCls}>
              {t}
            </span>
          ))}
        </div>
      )}
      <Kicker className="mb-1.5">Notes</Kicker>
      <div className={cx("text-sm leading-relaxed whitespace-pre-wrap", d.notes ? "text-text2" : "text-muted")}>{d.notes || "No notes yet."}</div>
      {d.source && (
        <a href={d.source} target="_blank" rel="noopener noreferrer" className="mt-3.5 inline-flex items-center gap-1.5 text-13 text-accent hover:underline">
          <ArrowUpRightIcon size={12} />
          {sourceShort(d.source)}
        </a>
      )}
      {d.addedBy && <div className="mt-3 font-mono text-2xs text-muted">added by {d.addedBy}</div>}
    </>
  );
}

export function CardViewDialog({ card: d, onClose, onEdit }: { card: TripCard; onClose(): void; onEdit(): void }) {
  const tm = typeMeta(d.type);
  return (
    <Dialog label={d.title || "Untitled"} onClose={onClose} accent={tm.color}>
      <Head onClose={onClose}>
        <TypeLabel color={tm.color}>{tm.label}</TypeLabel>
      </Head>
      <div className={body}>
        <CardViewBody card={d} />
      </div>
      <Foot className="justify-end">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onEdit}>
          Edit
        </Button>
      </Foot>
    </Dialog>
  );
}

// ---------------------------------------------------------------- card editor

/** Region field that offers the regions already used on other cards while typing (arrows + Enter, or click). */
function RegionInput({ id, value, onChange, options }: { id: string; value: string; onChange(v: string): void; options(typed: string): string[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = open ? options(value) : [];
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!list.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            // Cycles through the options and back to the typed text (-1).
            const step = e.key === "ArrowDown" ? 1 : -1, n = list.length + 1;
            setActive((i) => ((i + 1 + step + n) % n) - 1);
          } else if (e.key === "Enter" && active >= 0 && active < list.length) {
            e.preventDefault();
            pick(list[active]);
          } else if (e.key === "Escape") {
            // Close the list, not the dialog.
            e.stopPropagation();
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={list.length > 0}
        aria-controls="region-options"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && active < list.length ? "region-opt-" + active : undefined}
        aria-label="Region or place"
        autoComplete="off"
        placeholder="Neighborhood, City"
        className={inputCls}
      />
      {list.length > 0 && (
        <div id="region-options" role="listbox" aria-label="Regions used before" className="absolute inset-x-0 top-[calc(100%+4px)] z-[5] rounded-[9px] border border-wh bg-card p-1 shadow-[var(--shadow-pop)] [animation:gfade_120ms_ease-out]">
          {list.map((r, i) => (
            <div
              key={r}
              id={"region-opt-" + i}
              role="option"
              aria-selected={i === active}
              // mousedown, so the input keeps focus and the blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx("cursor-pointer truncate rounded-md px-2.5 py-2 text-13 text-text2", i === active && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]")}
            >
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A labelled block of the editor. */
function Field({ label, htmlFor, aside, children, className }: { label: string; htmlFor?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-2 border-t border-wf pt-4">
      <Kicker as="h3" className="mb-3">
        {title}
      </Kicker>
      {children}
    </section>
  );
}

export function CardEditorDialog({ modal: m, setModal, confirmDel, onSave, onDelete, onClose }: {
  modal: CardModal;
  setModal: Dispatch<SetStateAction<CardModal | null>>;
  confirmDel: boolean;
  onSave(m: CardModal): void;
  onDelete(m: CardModal): void;
  onClose(): void;
}) {
  const { data, trip, cards, moveOrder, openEdit } = useTripCtx();
  const uid = useId();
  const set = (patch: Partial<CardModal>) => setModal((s) => (s ? { ...s, ...patch } : s));
  const header = m.__new ? "New card" : "Edit card";
  const loc = locStatus(m);
  const locText = m.locText != null ? m.locText : locStr(m.loc);
  const suggest = tagSuggestions(data.cards, m.tags || [], m.tagInput || "");
  const days = trip?.dayCount || 0;

  const commitTag = (raw: string) => set({ tags: addTag(m.tags, raw), tagInput: "" });

  // Coordinates with no Region or country yet: name the area (and note the
  // country) from them, once they stop changing. One lookup; a Region typed
  // meanwhile wins.
  const at = parseLoc(locText);
  const atKey = at ? at.lat.toFixed(5) + "," + at.lng.toFixed(5) : "";
  useEffect(() => {
    if (!at || ((m.region || "").trim() && m.country)) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(reverseUrl(at), { headers: { Accept: "application/json" }, signal: ac.signal })
        .then((r) => r.json())
        .then((j) => {
          const region = regionFromAddress(j?.address);
          const country = String(j?.address?.country_code || "").toLowerCase();
          setModal((s) => {
            if (!s) return s;
            const patch = { ...(region && !(s.region || "").trim() ? { region } : {}), ...(country && !s.country ? { country } : {}) };
            return Object.keys(patch).length ? { ...s, ...patch } : s;
          });
        })
        .catch(() => {});
    }, 600);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
    // at is read through atKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atKey]);

  // The query of the last search, so leaving the field again (or Find right after) doesn't repeat it.
  const searched = useRef("");
  // A place name is looked up on Enter, on Find, or when the field is left. It
  // searches the trip's own area first (around its other located cards), and
  // only then everywhere; a match far from the trip is never picked on its own.
  const lookup = async () => {
    const raw = String(locText).trim();
    if (!raw || parseLoc(raw) || m.locBusy) return;
    const q = locQuery(raw, m.title, m.region);
    if (!q) return set({ locErr: "noquery" });
    if (searched.current === q) return;
    searched.current = q;
    set({ locBusy: true, locErr: null, locChoices: null, locPicking: false, locFar: false, locFound: null });
    const area = tripArea(cards, m.id);
    const others = cards.filter((c) => c.id !== m.id && c.loc && isFinite(c.loc.lat)).map((c) => c.loc!);
    try {
      // Locked to the trip's countries once they're known (from its other stops).
      const countries = await tripCountries(cards, m.id);
      if (countries.length) {
        const found = byNearness(await searchPlaces(q, { countries }), others);
        if (!found.length) return set({ locBusy: false, locErr: "outside", locCountries: countries });
        return set({ locBusy: false, locCountries: countries, locChoices: found, locText: locStr(found[0]), locFound: found[0].name, country: found[0].country || undefined });
      }
      // No located stop yet (or no answer about countries): the area, then anywhere, never auto-picking a far match.
      const near = area ? await searchPlaces(q, { area }) : [];
      const anywhere = near.length ? [] : await searchPlaces(q);
      const r = pickPlace(near, anywhere, others, area);
      if (!r.choices.length) {
        searched.current = "";
        return set({ locBusy: false, locErr: "none" });
      }
      set({ locBusy: false, locChoices: r.choices, locPicking: !r.pick, locFar: r.far, ...(r.pick ? { locText: locStr(r.pick), locFound: r.pick.name, country: r.pick.country || undefined } : {}) });
    } catch {
      searched.current = "";
      set({ locBusy: false, locErr: "none" });
    }
  };
  // Nothing in the trip's countries: the user can still look further, and choose.
  const searchEverywhere = async () => {
    const q = locQuery(String(locText).trim(), m.title, m.region);
    if (!q) return;
    set({ locBusy: true, locErr: null });
    try {
      const all = await searchPlaces(q);
      set(all.length ? { locBusy: false, locChoices: all, locPicking: true, locFar: true } : { locBusy: false, locErr: "none" });
    } catch {
      set({ locBusy: false, locErr: "none" });
    }
  };
  const choose = (p: Place) => set({ locText: locStr(p), locFound: p.name, locPicking: false, locErr: null, country: p.country || undefined });
  const picked = parseLoc(locText);
  const otherMatches = (m.locChoices?.length ?? 0) - (picked ? 1 : 0);

  const id = (k: string) => uid + k;
  const locTone = loc.hint === "✓ on the map" ? "text-accent" : loc.hint === "no coordinates yet" ? "text-warn" : "text-muted";

  return (
    <Dialog label={header} onClose={onClose} accent={typeMeta(m.type).color}>
      <Head onClose={onClose}>
        <Kicker>{header}</Kicker>
      </Head>
      <div className={body}>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} aria-label="Card title" autoComplete="off" placeholder="What is it? e.g. Fushimi Inari at dawn" className={cx(inputCls, "mb-4 py-3 text-base font-semibold")} />
        {/* A new card can switch to the one it repeats (dropping the draft); an edit only hears about it. */}
        <LookalikeNote found={lookalikes(cards, { id: m.id, title: m.title, source: m.source, loc: parseLoc(locText) })} onOpen={m.__new ? openEdit : undefined} className="-mt-2 mb-4" />

        <Field label="Type">
          <div role="group" aria-label="Type" className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <Chip key={t.value} on={m.type === t.value} color={t.color} onClick={() => set({ type: t.value })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Chip key={s.value} on={m.status === s.value} color={s.value === "idea" ? undefined : s.dot} onClick={() => set({ status: s.value })}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Priority">
          <div role="group" aria-label="Priority" className="grid grid-cols-3 gap-1.5">
            {PRIOS.map((p) => (
              <Chip key={p.value} on={m.priority === p.value} color="var(--must)" onClick={() => set({ priority: p.value })} className="justify-center">
                {p.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Section title="When">
          <Field label="Day">
            <div role="group" aria-label="Schedule this card" className="flex flex-wrap gap-1.5">
              {Array.from({ length: days + 1 }, (_, d) => (
                <Chip key={d} on={(m.day == null ? 0 : m.day) === d} onClick={() => set({ day: d === 0 ? null : d })}>
                  {d === 0 ? "Pool" : "Day " + d}
                </Chip>
              ))}
            </div>
            {m.day != null && !m.__new && (
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => moveOrder(m.id, -1)}>
                  ↑ Move earlier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => moveOrder(m.id, 1)}>
                  ↓ Move later
                </Button>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Start time" htmlFor={id("time")}>
              <input id={id("time")} type="time" value={m.startTime || ""} onChange={(e) => set({ startTime: e.target.value })} aria-label="Start time" className={inputCls} />
            </Field>
            <Field label="Time to allow" htmlFor={id("dur")}>
              <input id={id("dur")} value={m.duration || ""} onChange={(e) => set({ duration: e.target.value })} aria-label="Time to allow" autoComplete="off" placeholder="2h · half day" className={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title="Where">
          <Field label="Region / place" htmlFor={id("region")}>
            <RegionInput id={id("region")} value={m.region || ""} onChange={(region) => set({ region })} options={(typed) => regionSuggestions(data.cards, typed)} />
          </Field>
          <Field label="Location" htmlFor={id("loc")} aside={<span className={cx("font-mono text-2xs whitespace-nowrap", locTone)}>{loc.hint}</span>}>
            <div className="flex gap-2">
              <input
                id={id("loc")}
                value={locText}
                onChange={(e) => set({ locText: e.target.value, locErr: null, locChoices: null, locPicking: false, locFar: false, locFound: null, locCountries: null, country: undefined })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void lookup();
                  }
                }}
                // Leaving the field searches too, unless it's for the Find button (its click does).
                onBlur={(e) => !(e.relatedTarget as HTMLElement | null)?.hasAttribute("data-loc-find") && void lookup()}
                aria-label="Location — place name, Maps link or coordinates"
                aria-describedby={id("locnote")}
                autoComplete="off"
                spellCheck={false}
                placeholder="Place name, Maps link, or 35.6764, 139.6500"
                className={cx(inputCls, "min-w-0 flex-1")}
              />
              <Button variant="soft" data-loc-find="" onClick={() => void lookup()} aria-busy={!!m.locBusy}>
                {loc.button}
              </Button>
            </div>
            <div id={id("locnote")} className="mt-1.5 text-xs leading-normal text-pretty text-muted">
              {loc.note}
              {m.locErr === "outside" && (
                <>
                  {" "}
                  <button type="button" onClick={() => void searchEverywhere()} className="cursor-pointer font-semibold text-accent hover:underline">
                    Search everywhere
                  </button>
                </>
              )}
              {picked && !m.locPicking && otherMatches > 0 && (
                <>
                  {" "}
                  <button type="button" onClick={() => set({ locPicking: true })} className="cursor-pointer font-semibold text-accent hover:underline">
                    {`Not this one? ${otherMatches} other ${otherMatches === 1 ? "match" : "matches"}`}
                  </button>
                </>
              )}
            </div>
            {m.locPicking && !!m.locChoices?.length && (
              <div role="group" aria-label="Places that match" className="mt-2 flex flex-col gap-1 rounded-[10px] border border-wh bg-inset p-1">
                {m.locChoices.map((p, i) => {
                  const [head, ...rest] = p.name.split(", ");
                  const on = !!picked && Math.abs(picked.lat - p.lat) < 1e-5 && Math.abs(picked.lng - p.lng) < 1e-5;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => choose(p)}
                      aria-current={on || undefined}
                      className={cx("flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors", on ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "hover:bg-wc")}
                    >
                      <span className="mt-px w-6 shrink-0 font-mono text-2xs font-semibold text-muted uppercase">{p.country || "—"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-13 font-semibold text-text">{head}</span>
                        {rest.length > 0 && <span className="block truncate text-2xs text-muted">{rest.join(", ")}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </Section>

        <Section title="Details">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Price" htmlFor={id("price")}>
              <input id={id("price")} value={String(m.price ?? "")} onChange={(e) => set({ price: e.target.value as never })} aria-label="Price" placeholder="0" inputMode="decimal" autoComplete="off" className={inputCls} />
            </Field>
            <Field label="Source link" htmlFor={id("src")}>
              <input id={id("src")} type="url" value={m.source || ""} onChange={(e) => set({ source: e.target.value })} aria-label="Source link" autoComplete="off" spellCheck={false} placeholder="https://" className={inputCls} />
            </Field>
          </div>
          <Field label="Tags" htmlFor={id("tag")}>
            {(m.tags || []).length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(m.tags || []).map((t, i) => (
                  <button key={i} type="button" onClick={() => set({ tags: (m.tags || []).filter((x) => x !== t) })} aria-label={"Remove tag " + t} className={cx(tagCls, "cursor-pointer hover:brightness-110")}>
                    {t} <CloseIcon size={9} />
                  </button>
                ))}
              </div>
            )}
            <input
              id={id("tag")}
              value={m.tagInput || ""}
              onChange={(e) => set({ tagInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitTag(m.tagInput || "");
                }
              }}
              aria-label="Add a tag"
              autoComplete="off"
              spellCheck={false}
              placeholder="Type a tag, then Enter"
              className={inputCls}
            />
            {suggest.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggest.map((t) => (
                  <button key={t} type="button" onClick={() => commitTag(t)} aria-label={"Add tag " + t} className="cursor-pointer rounded-full border border-wh px-2.5 py-1 text-xs text-muted transition-colors hover:border-wl hover:text-text">
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Notes" htmlFor={id("notes")} className="mb-0">
            <textarea id={id("notes")} value={m.notes || ""} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" placeholder="Tips, why it made the list…" className={cx(inputCls, "min-h-[90px] resize-y leading-normal")} />
          </Field>
        </Section>
      </div>
      <Foot>
        {m.__new ? (
          <div />
        ) : (
          <Button variant={confirmDel ? "dangerSolid" : "danger"} onClick={() => onDelete(m)}>
            {confirmDel ? "Tap again to delete" : "Delete"}
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(m)}>
            Save
          </Button>
        </div>
      </Foot>
    </Dialog>
  );
}

// ---------------------------------------------------------------- trip editor

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function TripEditorDialog({ modal: d, setModal, onSave, onClose, onDelete }: {
  modal: TripModal;
  setModal: Dispatch<SetStateAction<TripModal | null>>;
  onSave(d: TripModal): void;
  onClose(): void;
  /** Missing for a trip shared with the user: only its owner deletes it. */
  onDelete?(): void;
}) {
  const uid = useId();
  const set = (patch: Partial<TripModal>) => setModal((s) => (s ? { ...s, ...patch } : s));
  const header = d.__new ? "New trip" : "Edit trip";
  // A new trip can invite people right away; they're sent once it's created.
  const [inviteText, setInviteText] = useState("");
  const invites = d.invites || [];
  const addInvite = () => {
    const email = inviteText.trim().toLowerCase();
    if (!isEmail(email)) return;
    if (!invites.includes(email)) set({ invites: [...invites, email] });
    setInviteText("");
  };
  const save = () => {
    const typed = inviteText.trim().toLowerCase();
    onSave(isEmail(typed) && !invites.includes(typed) ? { ...d, invites: [...invites, typed] } : d);
  };
  return (
    <Dialog label={header} onClose={onClose} narrow>
      <Head onClose={onClose}>
        <Kicker>{header}</Kicker>
      </Head>
      <div className={body}>
        <Field label="Trip name" htmlFor={uid + "name"}>
          <input id={uid + "name"} value={d.name || ""} onChange={(e) => set({ name: e.target.value })} aria-label="Trip name" autoComplete="off" placeholder="e.g. Japan · Cherry Season" className={cx(inputCls, "py-3 text-base font-semibold")} />
        </Field>
        <Field label="Route / subtitle" htmlFor={uid + "sub"}>
          <input id={uid + "sub"} value={d.subtitle || ""} onChange={(e) => set({ subtitle: e.target.value })} aria-label="Route or subtitle" autoComplete="off" placeholder="Tokyo → Kyoto → Osaka" className={inputCls} />
        </Field>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel>Start date</FieldLabel>
            <DatePicker value={d.start || ""} placeholder="Pick a date" onChange={(iso) => set({ start: iso })} />
          </div>
          <div>
            <FieldLabel>End date</FieldLabel>
            <DatePicker value={d.end || ""} placeholder="Pick a date" onChange={(iso) => set({ end: iso })} />
          </div>
        </div>
        <Field label="Budget" htmlFor={uid + "budget"} className="mb-0">
          <div className="flex items-stretch gap-2">
            <span aria-hidden className="flex items-center rounded-[9px] border border-wh bg-inset px-3 text-sm font-bold text-muted">
              $
            </span>
            <input id={uid + "budget"} value={String(d.budget ?? "")} onChange={(e) => set({ budget: e.target.value as never })} aria-label="Budget in dollars" placeholder="2000" inputMode="decimal" autoComplete="off" className={cx(inputCls, "min-w-0 flex-1")} />
          </div>
        </Field>
        {d.__new && (
          <Field label="Invite people (optional)" htmlFor={uid + "invite"} className="mt-4 mb-0">
            <div className="flex gap-2">
              <input
                id={uid + "invite"}
                type="email"
                value={inviteText}
                onChange={(e) => setInviteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addInvite();
                  }
                }}
                aria-label="Email to invite"
                autoComplete="off"
                spellCheck={false}
                placeholder="friend@example.com"
                className={cx(inputCls, "min-w-0 flex-1")}
              />
              <Button onClick={addInvite} disabled={!isEmail(inviteText)}>
                Add
              </Button>
            </div>
            {invites.length > 0 && (
              <ul aria-label="People to invite" className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                {invites.map((email) => (
                  <li key={email} className={tagCls}>
                    {email}
                    <button type="button" aria-label={"Don’t invite " + email} onClick={() => set({ invites: invites.filter((x) => x !== email) })} className="cursor-pointer opacity-70 hover:opacity-100">
                      <CloseIcon size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1.5 text-xs text-muted">They need an account. Guests can see and edit the trip; only you can delete it.</div>
          </Field>
        )}
      </div>
      <Foot>
        {d.__new || !onDelete ? (
          <div />
        ) : (
          <Button variant="danger" onClick={onDelete}>
            Delete trip
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {d.__new ? "Create trip" : "Save"}
          </Button>
        </div>
      </Foot>
    </Dialog>
  );
}

// ---------------------------------------------------------------- delete trip

export function DeleteTripDialog({ name, onCancel, onConfirm }: { name: string; onCancel(): void; onConfirm(): void }) {
  const uid = useId();
  const [typed, setTyped] = useState("");
  const match = !!name.trim() && typed.trim() === name.trim();
  return (
    <Dialog label="Delete this trip?" onClose={onCancel} top narrow accent="var(--neg)">
      <div className="px-5 pt-5 pb-4">
        <div className="mb-2 text-base font-bold text-text">Delete this trip?</div>
        <div className="mb-4 text-13 leading-normal text-muted">
          This permanently deletes <b className="text-text">{name}</b> and every card, note and plan in it. This can’t be undone.
        </div>
        <FieldLabel htmlFor={uid}>Type the trip name to confirm</FieldLabel>
        <input id={uid} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the trip name to confirm" autoComplete="off" spellCheck={false} placeholder={name} className={inputCls} />
      </div>
      <Foot className="justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="dangerSolid" onClick={() => match && onConfirm()} aria-disabled={!match}>
          Delete trip
        </Button>
      </Foot>
    </Dialog>
  );
}

// ---------------------------------------------------------------- share

const SHARE_ERRORS: Record<Exclude<ShareResult, "ok">, string> = {
  not_found: "No account uses that email. They need to sign up first.",
  self: "That’s you.",
  not_owner: "Only the trip’s owner can invite people.",
};

export function ShareTripDialog({ trip, me, access, notice, onShare, onRemove, onClose }: {
  trip: Trip;
  /** A first message, e.g. how the invites sent with a new trip went. */
  notice?: { text: string; error?: boolean } | null;
  me: string | null;
  access: TripAccess;
  onShare(email: string): Promise<ShareResult>;
  onRemove(userId: string): Promise<void>;
  onClose(): void;
}) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(notice ?? null);
  // A removal or leave asks twice: the first click arms it.
  const [armed, setArmed] = useState<string | null>(null);
  const valid = isEmail(email);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setMsg({ text: (e as { message?: string })?.message || "Something went wrong.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    valid &&
    !busy &&
    run(async () => {
      const r = await onShare(email.trim());
      if (r === "ok") {
        setMsg({ text: email.trim() + " can now see and edit this trip." });
        setEmail("");
      } else setMsg({ text: SHARE_ERRORS[r], error: true });
    });

  const remove = (userId: string) => {
    if (armed !== userId) return setArmed(userId);
    setArmed(null);
    void run(() => onRemove(userId));
  };

  const guests = access.people.filter((p) => p.role !== "owner");
  const owner = access.people.find((p) => p.role === "owner");

  return (
    <Dialog label="Share trip" onClose={onClose} narrow>
      <Head onClose={onClose}>
        <Kicker>Share · {trip.name || "Untitled trip"}</Kicker>
      </Head>
      <div className={body}>
        {access.owner && (
          <form
            className="mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
          >
            <FieldLabel htmlFor={uid + "email"}>Invite by email</FieldLabel>
            <div className="flex gap-2">
              <input
                id={uid + "email"}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setMsg(null);
                }}
                aria-label="Email to invite"
                autoComplete="off"
                spellCheck={false}
                placeholder="friend@example.com"
                className={cx(inputCls, "min-w-0 flex-1")}
              />
              <Button type="submit" variant="primary" disabled={!valid || busy}>
                Invite
              </Button>
            </div>
            <div className="mt-1.5 text-xs text-muted">Guests can see and edit everything in this trip. Only you can delete it.</div>
          </form>
        )}
        {msg && (
          <div role={msg.error ? "alert" : "status"} className={cx("mb-4 rounded-lg px-3 py-2 text-13", msg.error ? "bg-[color-mix(in_srgb,var(--neg)_12%,transparent)] text-neg" : "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent2")}>
            {msg.text}
          </div>
        )}
        <Kicker as="h3" className="mb-2">People</Kicker>
        <ul className="m-0 list-none p-0">
          <PersonRow email={owner ? owner.email : "You"} you={!owner || owner.user === me} role="Owner" />
          {guests.map((p) => {
            const you = p.user === me;
            const canAct = access.owner || you;
            return (
              <PersonRow key={p.user} email={p.email} you={you} role={p.role === "viewer" ? "Viewer" : "Editor"}>
                {canAct && (
                  <Button size="sm" variant={armed === p.user ? "dangerSolid" : "danger"} disabled={busy} onClick={() => remove(p.user)}>
                    {armed === p.user ? (you ? "Leave for good" : "Remove for good") : you ? "Leave trip" : "Remove"}
                  </Button>
                )}
              </PersonRow>
            );
          })}
        </ul>
        {!guests.length && <div className="mt-2 text-13 text-muted">Nobody else has this trip yet.</div>}
      </div>
      <Foot className="justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </Foot>
    </Dialog>
  );
}

function PersonRow({ email, you, role, children }: { email: string; you: boolean; role: string; children?: ReactNode }) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-wf py-1.5 last:border-b-0">
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip2 text-2xs font-bold text-text2 uppercase">
        {email.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 text-text">
          {email}
          {you && email !== "You" && <span className="text-muted"> (you)</span>}
        </span>
        <span className="block font-mono text-2xs text-muted">{role}</span>
      </span>
      {children}
    </li>
  );
}
