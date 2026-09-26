"use client";

// Trip Planner dialogs: read-only card view, card editor, trip editor and the
// type-the-name delete confirmation.
import { useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useDialog } from "@/lib/hooks/useDialog";
import {
  PRIOS, STATUSES, TYPES, addTag, locQuery, locStatus, locStr, money, parseLoc, tagSuggestions, typeMeta, type TripCard,
} from "@/lib/trips/model";
import { Fact, StatusPrio, sourceShort } from "./CompareDrawer";
import { T, btnGhost, btnPrimary, chip, frame, closeX, dialogFoot, dialogHead, dialogPanel, fieldLabel, input, kicker, overlay, tagChip, typeTag } from "./styles";
import { useTripCtx, type CardModal, type TripModal } from "./TripPlanner";

function Dialog({ label, onClose, children, panel, z }: { label: string; onClose(): void; children: ReactNode; panel?: CSSProperties; z?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div onClick={onClose} style={{ ...overlay, ...(z ? { zIndex: z, background: "rgba(6,8,9,.72)" } : {}) }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ ...dialogPanel, ...panel }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- view

export function CardViewDialog({ card: d, onClose, onEdit }: { card: TripCard; onClose(): void; onEdit(): void }) {
  const { trip } = useTripCtx();
  const tm = typeMeta(d.type);
  const tags = d.tags || [];
  const hasPrice = d.price != null && (d.price as unknown) !== "";
  return (
    <Dialog label={d.title || "Untitled"} onClose={onClose} panel={frame(T.border, "top", tm.color)}>
      <div style={{ ...dialogHead, padding: "14px 18px" }}>
        <span style={typeTag(tm.color)}>{tm.label}</span>
        <button type="button" onClick={onClose} aria-label="Close" style={closeX}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.01em", color: T.text, lineHeight: 1.25, marginBottom: 13 }}>{d.title || "Untitled"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 15 }}>
          <StatusPrio card={d} />
          <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 20, background: "rgba(95,184,176,.1)", border: "1px solid rgba(95,184,176,.28)", color: "#7fd0c8" }}>
            {d.day != null ? "Day " + d.day : "Pool"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 15 }}>
          {hasPrice && <Fact label="Price" value={money(d.price, trip?.currency)} size={15} bold />}
          {d.startTime && <Fact label="Start" value={d.startTime} size={15} />}
          {d.duration && <Fact label="Duration" value={d.duration} size={15} />}
        </div>
        {d.region && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.muted, marginBottom: 15 }}>
            <span style={{ color: T.accent }}>◉</span>
            {d.region}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 15 }}>
            {tags.map((t, i) => (
              <div key={i} style={tagChip}>
                {t}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: T.dim2, marginBottom: 5 }}>Notes</div>
        <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.notes || "No notes yet."}</div>
        {d.source && (
          <a href={d.source} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.accent, marginTop: 14 }}>
            <span>↗</span>
            {sourceShort(d.source)}
          </a>
        )}
        {d.addedBy && <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.dim3, marginTop: 12 }}>added by {d.addedBy}</div>}
      </div>
      <div style={{ ...dialogFoot, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          Close
        </button>
        <button type="button" onClick={onEdit} style={btnPrimary}>
          Edit
        </button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- card editor

const optBtn: CSSProperties = { font: "inherit", cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "6px 10px", borderRadius: 7 };

export function CardEditorDialog({ modal: m, setModal, confirmDel, onSave, onDelete, onClose }: {
  modal: CardModal;
  setModal: Dispatch<SetStateAction<CardModal | null>>;
  confirmDel: boolean;
  onSave(m: CardModal): void;
  onDelete(m: CardModal): void;
  onClose(): void;
}) {
  const { data, trip, moveOrder } = useTripCtx();
  const set = (patch: Partial<CardModal>) => setModal((s) => (s ? { ...s, ...patch } : s));
  const header = m.__new ? "New card" : "Edit card";
  const loc = locStatus(m);
  const locText = m.locText != null ? m.locText : locStr(m.loc);
  const suggest = tagSuggestions(data.cards, m.tags || [], m.tagInput || "");
  const days = trip?.dayCount || 0;

  const commitTag = (raw: string) => set({ tags: addTag(m.tags, raw), tagInput: "" });

  const lookup = () => {
    const raw = String(locText).trim();
    if (!raw || parseLoc(raw)) return;
    const q = locQuery(raw, m.title, m.region);
    if (!q) return set({ locErr: "noquery" });
    set({ locBusy: true, locErr: null });
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((j) => {
        const hit = j && j[0];
        if (!hit) throw new Error("none");
        set({ locText: (+hit.lat).toFixed(5) + ", " + (+hit.lon).toFixed(5), locBusy: false, locErr: null, locFound: hit.display_name });
      })
      .catch(() => set({ locBusy: false, locErr: "none" }));
  };

  return (
    <Dialog label={header} onClose={onClose}>
      <div style={dialogHead}>
        <div style={kicker}>{header}</div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeX}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 18 }}>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} aria-label="Card title" autoComplete="off" placeholder="Title" style={{ ...input, padding: "11px 13px", fontSize: 15, fontWeight: 600, marginBottom: 15 }} />

        <div style={fieldLabel}>Type</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {TYPES.map((t) => (
            <button key={t.value} type="button" aria-pressed={m.type === t.value} onClick={() => set({ type: t.value })} style={{ ...optBtn, ...chip(m.type === t.value, t.color) }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={fieldLabel}>Status</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {STATUSES.map((s) => (
            <button key={s.value} type="button" aria-pressed={m.status === s.value} onClick={() => set({ status: s.value })} style={{ ...optBtn, display: "flex", alignItems: "center", gap: 6, ...chip(m.status === s.value, s.value === "idea" ? T.muted2 : s.dot) }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot === "transparent" ? "#4a514c" : s.dot }} />
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={fieldLabel}>Price</div>
            <input value={String(m.price ?? "")} onChange={(e) => set({ price: e.target.value as never })} aria-label="Price" placeholder="0" inputMode="decimal" autoComplete="off" style={input} />
          </div>
          <div>
            <div style={fieldLabel}>Start time</div>
            <input type="time" value={m.startTime || ""} onChange={(e) => set({ startTime: e.target.value })} aria-label="Start time" style={input} />
          </div>
        </div>

        <div style={fieldLabel}>Priority</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {PRIOS.map((p) => (
            <button key={p.value} type="button" aria-pressed={m.priority === p.value} onClick={() => set({ priority: p.value })} style={{ ...optBtn, flex: 1, textAlign: "center", fontSize: 12, padding: "9px 6px", borderRadius: 8, ...chip(m.priority === p.value, T.must) }}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={fieldLabel}>Region / place</div>
        <input value={m.region || ""} onChange={(e) => set({ region: e.target.value })} aria-label="Region or place" autoComplete="off" placeholder="Neighborhood, City" style={{ ...input, marginBottom: 14 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div style={{ ...fieldLabel, marginBottom: 0 }}>Location</div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: loc.color, whiteSpace: "nowrap" }}>{loc.hint}</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            value={locText}
            onChange={(e) => set({ locText: e.target.value, locErr: null })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookup();
              }
            }}
            aria-label="Location — place name, Maps link or coordinates"
            autoComplete="off"
            spellCheck={false}
            placeholder="Place name, Maps link, or 35.6764, 139.6500"
            style={{ ...input, flex: 1, minWidth: 0 }}
          />
          <button type="button" onClick={lookup} style={{ font: "inherit", cursor: "pointer", flex: "0 0 auto", display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 600, color: "#9fd8d1", background: "rgba(95,184,176,.12)", border: "1px solid rgba(95,184,176,.32)", borderRadius: 9, padding: "0 13px", whiteSpace: "nowrap" }}>
            {loc.button}
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.dim3, lineHeight: 1.5, marginBottom: 14, textWrap: "pretty" }}>{loc.note}</div>

        <div style={fieldLabel}>Time to allow</div>
        <input value={m.duration || ""} onChange={(e) => set({ duration: e.target.value })} aria-label="Time to allow" autoComplete="off" placeholder="e.g. 2h · half day" style={{ ...input, marginBottom: 14 }} />

        <div style={fieldLabel}>Tags</div>
        {(m.tags || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
            {(m.tags || []).map((t, i) => (
              <button key={i} type="button" onClick={() => set({ tags: (m.tags || []).filter((x) => x !== t) })} aria-label={"Remove tag " + t} style={{ ...tagChip, font: "inherit", fontSize: 11.5, cursor: "pointer" }}>
                {t} <span aria-hidden="true" style={{ color: "#6b8f8a" }}>✕</span>
              </button>
            ))}
          </div>
        )}
        <input
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
          placeholder="Type a tag, Enter…"
          style={{ ...input, marginBottom: 9 }}
        />
        {suggest.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {suggest.map((t) => (
              <button key={t} type="button" onClick={() => commitTag(t)} aria-label={"Add tag " + t} style={{ font: "inherit", background: "none", cursor: "pointer", fontSize: 11, padding: "4px 9px", borderRadius: 20, color: T.muted2, border: `1px solid ${T.border2}` }}>
                + {t}
              </button>
            ))}
          </div>
        )}

        <div style={fieldLabel}>Source link</div>
        <input type="url" value={m.source || ""} onChange={(e) => set({ source: e.target.value })} aria-label="Source link" autoComplete="off" spellCheck={false} placeholder="https://" style={{ ...input, marginBottom: 14 }} />

        <div style={fieldLabel}>Day</div>
        <div role="group" aria-label="Schedule this card" style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {Array.from({ length: days + 1 }, (_, d) => {
            const active = (m.day == null ? 0 : m.day) === d;
            return (
              <button key={d} type="button" aria-pressed={active} onClick={() => set({ day: d === 0 ? null : d })} style={{ ...optBtn, ...chip(active) }}>
                {d === 0 ? "Pool" : "Day " + d}
              </button>
            );
          })}
        </div>
        {m.day != null && !m.__new && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button type="button" onClick={() => moveOrder(m.id, -1)} style={{ ...btnGhost, fontSize: 11.5, padding: "6px 11px", borderRadius: 7 }}>
              ↑ Move earlier
            </button>
            <button type="button" onClick={() => moveOrder(m.id, 1)} style={{ ...btnGhost, fontSize: 11.5, padding: "6px 11px", borderRadius: 7 }}>
              ↓ Move later
            </button>
          </div>
        )}

        <div style={fieldLabel}>Notes</div>
        <textarea value={m.notes || ""} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" placeholder="Tips, why it made the list…" style={{ ...input, minHeight: 90, resize: "vertical", padding: "10px 12px", lineHeight: 1.55 }} />
      </div>
      <div style={dialogFoot}>
        {m.__new ? (
          <div />
        ) : (
          <button type="button" onClick={() => onDelete(m)} style={{ font: "inherit", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: confirmDel ? "#fff" : T.danger, padding: "9px 13px", borderRadius: 8, border: `1px solid ${confirmDel ? "#c14b4b" : "#3a2828"}` }}>
            {confirmDel ? "Tap again to delete" : "Delete"}
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(m)} style={btnPrimary}>
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- trip editor

/** DatePicker tokens inside the always-dark Trip Planner. */
const pickerVars = {
  "--accent": T.accent, "--inset": T.bg, "--card": T.card, "--bg": T.bg, "--chip": "#161a1b", "--text": T.text, "--text2": T.text2,
  "--muted": T.muted2, "--dim": "#59605b", "--wh": T.border, "--wi": T.border2, "--we": T.line2, "--onAccent": T.onAccent,
} as CSSProperties;

export function TripEditorDialog({ modal: d, setModal, onSave, onClose, onDelete }: {
  modal: TripModal;
  setModal: Dispatch<SetStateAction<TripModal | null>>;
  onSave(d: TripModal): void;
  onClose(): void;
  onDelete(): void;
}) {
  const set = (patch: Partial<TripModal>) => setModal((s) => (s ? { ...s, ...patch } : s));
  const header = d.__new ? "New trip" : "Edit trip";
  return (
    <Dialog label={header} onClose={onClose} panel={{ maxWidth: 440 }}>
      <div style={dialogHead}>
        <div style={kicker}>{header}</div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeX}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 18 }}>
        <div style={fieldLabel}>Trip name</div>
        <input value={d.name || ""} onChange={(e) => set({ name: e.target.value })} aria-label="Trip name" autoComplete="off" placeholder="e.g. Japan · Cherry Season" style={{ ...input, padding: "11px 13px", fontSize: 15, fontWeight: 600, marginBottom: 15 }} />
        <div style={fieldLabel}>Route / subtitle</div>
        <input value={d.subtitle || ""} onChange={(e) => set({ subtitle: e.target.value })} aria-label="Route or subtitle" autoComplete="off" placeholder="Tokyo → Kyoto → Osaka" style={{ ...input, marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, ...pickerVars }}>
          <div>
            <div style={fieldLabel}>Start date</div>
            <DatePicker value={d.start || ""} placeholder="Pick a date" onChange={(iso) => set({ start: iso })} />
          </div>
          <div>
            <div style={fieldLabel}>End date</div>
            <DatePicker value={d.end || ""} placeholder="Pick a date" onChange={(iso) => set({ end: iso })} />
          </div>
        </div>
        <div style={fieldLabel}>Budget</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 700, color: T.muted2, padding: "9px 13px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>$</div>
          <input value={String(d.budget ?? "")} onChange={(e) => set({ budget: e.target.value as never })} aria-label="Budget in dollars" placeholder="2000" inputMode="decimal" autoComplete="off" style={{ ...input, flex: 1, minWidth: 0 }} />
        </div>
      </div>
      <div style={dialogFoot}>
        {d.__new ? (
          <div />
        ) : (
          <button type="button" onClick={onDelete} style={{ font: "inherit", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.danger, padding: "9px 13px", borderRadius: 8, border: "1px solid #3a2828" }}>
            Delete trip
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(d)} style={btnPrimary}>
            {d.__new ? "Create trip" : "Save"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- delete trip

export function DeleteTripDialog({ name, onCancel, onConfirm }: { name: string; onCancel(): void; onConfirm(): void }) {
  const [typed, setTyped] = useState("");
  const match = !!name.trim() && typed.trim() === name.trim();
  return (
    <Dialog label="Delete this trip?" onClose={onCancel} z={90} panel={{ maxWidth: 400, ...frame("#3a2828", "top", "#3a2828", 1), maxHeight: undefined }}>
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Delete this trip?</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.55, marginBottom: 16 }}>
          This permanently deletes <b style={{ color: T.text }}>{name}</b> and every card, note and plan in it. This can’t be undone.
        </div>
        <div style={fieldLabel}>Type the trip name to confirm</div>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the trip name to confirm" autoComplete="off" spellCheck={false} placeholder={name} style={{ ...input, border: "1px solid #3a2828", padding: "10px 12px" }} />
      </div>
      <div style={{ ...dialogFoot, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={btnGhost}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => match && onConfirm()}
          aria-disabled={!match}
          style={{ font: "inherit", fontSize: 12.5, fontWeight: 700, padding: "9px 18px", borderRadius: 8, border: "none", ...(match ? { cursor: "pointer", color: "#fff", background: "#c14b4b" } : { cursor: "not-allowed", color: "#6b5555", background: "#2a1c1c" }) }}
        >
          Delete trip
        </button>
      </div>
    </Dialog>
  );
}
