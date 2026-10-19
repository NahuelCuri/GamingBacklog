"use client";

// Cards tab: search, type filters and a grid of every card in the trip. In
// compare mode a tap adds or removes the card from the compare drawer.
import { useRef, useState } from "react";
import { ClockIcon, CloseIcon, PencilIcon, PlusIcon, SearchIcon, StarIcon, SwapIcon, WarningCircleIcon } from "@/components/icons";
import { useEnterStagger } from "@/lib/hooks/useEnterStagger";
import { matchesSearch, matchesType, money, statusMeta, typeFilterOptions, typeMeta } from "@/lib/trips/model";
import { toggleInCompare } from "./CompareDrawer";
import { FxPanel } from "./FxPanel";
import { useTripCtx } from "./TripPlanner";
import { Button, Chip, IconButton, TypeLabel, cx, inputCls, tint } from "./ui";

export function CardsTab() {
  const { trip, cards, poolFilter, setPoolFilter, compare, setCompare, openCard, openEdit, newCard } = useTripCtx();
  const [search, setSearch] = useState("");
  const [fxOpen, setFxOpen] = useState(false);
  const shown = cards.filter((c) => matchesType(c, poolFilter) && matchesSearch(c, search));
  const open = (id: string) => (compare.on ? setCompare((c) => toggleInCompare(c, id)) : openCard(id));
  const cardEls = useRef(new Map<string, HTMLElement>());
  useEnterStagger(
    shown.map((c) => c.id),
    (id) => cardEls.current.get(id),
  );
  const filters = typeFilterOptions(cards);

  return (
    <div className="g-scroll min-h-0 flex-1 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-28 tp:px-6">
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <div className="relative flex min-w-[220px] flex-1">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
              <SearchIcon size={15} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cards"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search title, tag, place or notes"
              className={cx(inputCls, "h-10 bg-surface pr-10 pl-10 text-sm pointer-coarse:h-11")}
            />
            {search && (
              <IconButton aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-1 -translate-y-1/2">
                <CloseIcon size={12} />
              </IconButton>
            )}
          </div>
          <div className="flex gap-2">
            <div data-tour="card-tools" className="flex gap-2">
            <Button variant={compare.on ? "soft" : "secondary"} aria-pressed={compare.on} title="Compare cards side by side" onClick={() => setCompare((c) => (c.on ? { ...c, on: false, open: [], min: false } : { ...c, on: true, min: false }))}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 4 4 8l4 4M4 8h13M16 20l4-4-4-4M20 16H7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Compare
            </Button>
            <Button variant={fxOpen ? "soft" : "secondary"} aria-expanded={fxOpen} title="Currency converter" onClick={() => setFxOpen((o) => !o)}>
              <SwapIcon size={15} />
              Convert
            </Button>
            </div>
            <Button variant="primary" onClick={() => newCard()} data-tour="new-card">
              <PlusIcon size={14} />
              New card
            </Button>
          </div>
        </div>

        {filters.length > 2 && (
          <div role="group" aria-label="Show" className="mb-5 flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <Chip key={f.value} on={poolFilter === f.value} color={f.color} onClick={() => setPoolFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        )}
        {compare.on && <p className="mt-0 mb-4 text-13 text-muted">Pick cards to compare them side by side below.</p>}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3.5">
          {shown.map((c) => {
            const tm = typeMeta(c.type), sm = statusMeta(c.status);
            const inCompare = compare.open.some((o) => o.id === c.id);
            const important = c.type === "important";
            const tags = c.tags || [];
            return (
              <article
                key={c.id}
                ref={(el) => {
                  if (el) cardEls.current.set(c.id, el);
                  else cardEls.current.delete(c.id);
                }}
                style={tint(tm.color)}
                className={cx(
                  "relative flex flex-col gap-2 rounded-xl border border-l-[3px] border-l-[var(--c)] px-3.5 py-3 transition-[border-color,background-color] duration-150 hover:border-wl hover:border-l-[var(--c)]",
                  inCompare ? "border-accent" : important ? "border-[color-mix(in_srgb,var(--must)_40%,transparent)]" : "border-wf",
                  important ? "bg-[color-mix(in_srgb,var(--must)_7%,var(--card))]" : "bg-card",
                )}
              >
                <h3 className="m-0 pr-9 text-sm leading-[1.3] font-bold text-text">
                  {/* The whole card opens it; the button's box is stretched over the card. */}
                  <button type="button" aria-label={(c.title || "Card") + " — open"} aria-pressed={compare.on ? inCompare : undefined} onClick={() => open(c.id)} className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-[inherit] after:content-['']">
                    {c.title || "Untitled"}
                  </button>
                </h3>
                <IconButton aria-label={"Edit " + (c.title || "card")} title="Edit card" onClick={() => openEdit(c.id)} className="absolute top-2 right-2 z-[1]">
                  <PencilIcon size={13} />
                </IconButton>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                  <TypeLabel color={tm.color} icon={important ? <WarningCircleIcon size={11} /> : undefined}>
                    {tm.label}
                  </TypeLabel>
                  <span style={tint(c.status === "idea" ? undefined : sm.dot)} className={cx("font-semibold", c.status === "idea" ? "text-muted" : "tp-ink")}>
                    {sm.label}
                  </span>
                  {c.price != null && <span className="font-mono text-price">{money(c.price, trip?.currency)}</span>}
                </div>
                {c.region && <div className="text-xs text-muted">{c.region}</div>}
                {(c.duration || tags.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {c.duration && (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={11} />
                        {c.duration}
                      </span>
                    )}
                    {tags.length > 0 && <span>{tags.slice(0, 3).join(" · ")}</span>}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-0.5">
                  <span className={cx("font-mono text-2xs font-semibold", c.day != null ? "text-accent2" : "text-muted")}>{c.day != null ? "Day " + c.day : "Pool"}</span>
                  <div className="flex items-center gap-2">
                    {c.priority === "must" && (
                      <span className="inline-flex items-center gap-0.5 text-2xs font-bold text-must">
                        <StarIcon size={10} />
                        must
                      </span>
                    )}
                    {inCompare && <span className="rounded bg-accent px-1.5 py-0.5 text-2xs font-bold text-on-accent">In compare</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {shown.length === 0 && (
          <div className="px-3 py-16 text-center">
            <div className="text-sm font-semibold text-text2">{cards.length ? "No cards match" : "No cards yet"}</div>
            <div className="mt-1 text-13 text-muted">{cards.length ? "Try another word or type." : "Add places, food and plans with New card, or quick-add them from the Itinerary."}</div>
            {cards.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch("");
                  setPoolFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
      {fxOpen && <FxPanel onClose={() => setFxOpen(false)} />}
    </div>
  );
}
