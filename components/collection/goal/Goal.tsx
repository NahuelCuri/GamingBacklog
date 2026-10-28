"use client";

// Yearly goal ("read 24 books in 2026"): a slim progress card on the Library
// tab, a fuller card on Stats, and the dialog that sets the number. Progress is
// counted from the library (lib/goals.ts); only the target is stored.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PencilIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { accentButton, closeButton, secondaryButton, toggleChip } from "@/components/ui/Pills";
import { MON, fmt } from "@/lib/collection/format";
import type { GoalConfig, Item } from "@/lib/collection/types";
import { goalHistory, goalProgress, type GoalProgress } from "@/lib/goals";
import type { GoalsApi } from "@/lib/hooks/useGoals";
import { useCollectionCtx } from "../CollectionContext";

const PRESETS = [12, 24, 36, 52];

/** Finished fill, a faint tail for the ones under way, and a tick where an even pace would be today. */
function GoalBar({ p, height = 8 }: { p: GoalProgress; height?: number }) {
  const target = p.target || 1;
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const done = Math.min(1, p.count / target);
  const tail = Math.min(1 - done, p.inProgress / target);
  const met = p.count >= target;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={p.count}
      aria-label={`${p.count} of ${target}`}
      className="relative w-full rounded-full bg-chip"
      style={{ height }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          width: `${(grown ? done : 0) * 100}%`,
          background: "var(--accent)",
          boxShadow: met ? "0 0 12px color-mix(in srgb, var(--accent) 55%, transparent)" : undefined,
        }}
      />
      {tail > 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 rounded-r-full opacity-30 motion-safe:transition-[left,width] motion-safe:duration-700"
          style={{ left: `${(grown ? done : 0) * 100}%`, width: `${(grown ? tail : 0) * 100}%`, background: "var(--accent)" }}
        />
      )}
      {p.elapsed != null && !met && (
        <div
          aria-hidden
          title="Where an even pace would be today"
          className="absolute -top-[3px] -bottom-[3px] w-0.5 -translate-x-1/2 rounded-full bg-text3"
          style={{ left: `${Math.min(1, p.elapsed) * 100}%` }}
        />
      )}
    </div>
  );
}

/** "2 ahead" / "On track" / "3 behind" / "Goal reached", for the current year. */
function Pace({ p }: { p: GoalProgress }) {
  if (!p.target) return null;
  if (p.count >= p.target)
    return (
      <span className="font-semibold text-accent">
        <span>Goal reached</span> ✓{p.count > p.target && <span className="font-mono font-normal text-muted"> +{p.count - p.target}</span>}
      </span>
    );
  if (p.ahead == null) return null;
  if (p.ahead === 0) return <span className="text-accent">On track</span>;
  return (
    <span className={p.ahead > 0 ? "text-accent" : "text-muted2"}>
      <span className="font-mono font-semibold">{Math.abs(p.ahead)}</span> <span>{p.ahead > 0 ? "ahead" : "behind"}</span>
    </span>
  );
}

/** Finished items with no date: they can't count toward any year. */
function Undated({ items, noun }: { items: Item[]; noun: string }) {
  const { cfg, openEdit } = useCollectionCtx();
  if (!items.length) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
      <span>
        <span className="font-mono text-[#e0b86a]">{items.length}</span> <span>{`finished ${noun} without a date don't count:`}</span>
      </span>
      {shown.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => openEdit(g)}
          className="cursor-pointer rounded-md border border-wf bg-chip px-2 py-0.5 text-xs text-text2 hover:border-wi hover:text-text"
        >
          {String(g[cfg.modal.titleField] || g.id)}
        </button>
      ))}
      {items.length > shown.length && <span className="font-mono">+{items.length - shown.length}</span>}
    </div>
  );
}

function useGoalYear(goal: GoalConfig, goals: GoalsApi, year: number) {
  const { items } = useCollectionCtx();
  const target = goals.goals?.[year] ?? null;
  return useMemo(() => goalProgress(goal, items, year, target), [goal, items, year, target]);
}

/** Library tab: one line under the metric strip. Just a quiet chip while no goal is set. */
export function GoalCard() {
  const { cfg, goals, isMobile } = useCollectionCtx();
  const year = new Date().getFullYear();
  const [editing, setEditing] = useState(false);
  if (!cfg.goal || !goals?.goals) return null;
  return (
    <>
      <GoalCardBody goal={cfg.goal} goals={goals} year={year} isMobile={isMobile} onEdit={() => setEditing(true)} />
      {goals.error && !editing && (
        <p role="alert" className="-mt-2 mb-4 text-xs text-neg">
          {goals.error}
        </p>
      )}
      {editing && <GoalDialog goal={cfg.goal} goals={goals} year={year} onClose={() => setEditing(false)} />}
    </>
  );
}

function GoalCardBody({ goal, goals, year, isMobile, onEdit }: { goal: GoalConfig; goals: GoalsApi; year: number; isMobile: boolean; onEdit(): void }) {
  const p = useGoalYear(goal, goals, year);
  if (!p.target)
    return (
      <div className="-mt-1.5 mb-4">
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer rounded-full border border-dashed border-wh bg-transparent px-3.5 py-1.5 text-[12.5px] text-muted2 transition-colors duration-200 hover:border-wi hover:text-text"
        >
          <span className="text-accent">+</span> <span>Set a reading goal</span> <span className="font-mono">{year}</span>
        </button>
      </div>
    );
  const label = (
    <div className="flex flex-none items-baseline gap-2 text-[11px] font-semibold tracking-[.09em] text-dim uppercase">
      <span className="font-mono">{year}</span>
      <span>{goal.label}</span>
    </div>
  );
  const count = (
    <div className="flex-none font-mono text-[13px] tabular-nums">
      <span className="font-semibold text-text">{p.count}</span>
      <span className="text-dim"> / {p.target}</span> <span className="font-sans text-dim">{goal.noun}</span>
    </div>
  );
  const edit = (
    <button type="button" onClick={onEdit} aria-label="Edit goal" title="Edit goal" className={closeButton + " -my-1.5 -mr-1.5 flex-none"}>
      <PencilIcon size={13} />
    </button>
  );
  return (
    <section aria-label={goal.label} className="mb-4 rounded-xl border border-wd bg-card px-4 py-3">
      {isMobile ? (
        <>
          <div className="mb-2.5 flex items-center gap-3">
            {label}
            <div className="flex-1" />
            <div className="text-xs">
              <Pace p={p} />
            </div>
            {edit}
          </div>
          <GoalBar p={p} />
          <div className="mt-2">{count}</div>
        </>
      ) : (
        <div className="flex items-center gap-5">
          {label}
          <div className="min-w-0 flex-1">
            <GoalBar p={p} />
          </div>
          {count}
          <div className="w-[104px] flex-none text-right text-[12.5px]">
            <Pace p={p} />
          </div>
          {edit}
        </div>
      )}
      <Undated items={p.undated} noun={goal.noun} />
    </section>
  );
}

/** Stats tab: the year's goal with its monthly rhythm, and how earlier years ended. */
export function GoalWidget() {
  const { cfg, goals, items } = useCollectionCtx();
  const now = new Date().getFullYear();
  const [year, setYear] = useState(now);
  const [editing, setEditing] = useState(false);
  const goal = cfg.goal;
  const history = useMemo(() => (goal && goals?.goals ? goalHistory(goal, items, goals.goals) : []), [goal, items, goals?.goals]);
  if (!goal || !goals?.goals) return null;
  return (
    <>
      <GoalWidgetBody goal={goal} goals={goals} year={year} now={now} history={history} onYear={setYear} onEdit={() => setEditing(true)} />
      {editing && <GoalDialog goal={goal} goals={goals} year={year} onClose={() => setEditing(false)} />}
    </>
  );
}

function GoalWidgetBody({
  goal, goals, year, now, history, onYear, onEdit,
}: {
  goal: GoalConfig;
  goals: GoalsApi;
  year: number;
  now: number;
  history: ReturnType<typeof goalHistory>;
  onYear(y: number): void;
  onEdit(): void;
}) {
  const p = useGoalYear(goal, goals, year);
  const current = year === now;
  const month = new Date().getMonth();
  const perMonth = p.target ? p.target / 12 : 0;
  const top = Math.max(1, perMonth, ...p.months);

  return (
    <section className="rounded-[14px] border border-wd bg-surface px-[22px] py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="m-0 flex items-baseline gap-2 text-[11px] font-semibold tracking-[.09em] text-dim uppercase">
          <span className="font-mono">{year}</span>
          <span>{goal.label}</span>
        </h3>
        <div className="flex items-center gap-1">
          {!current && (
            <button type="button" onClick={() => onYear(now)} className="cursor-pointer border-none bg-transparent px-1 text-xs text-accent underline-offset-2 hover:underline">
              This year
            </button>
          )}
          <button type="button" onClick={onEdit} aria-label="Edit goal" title="Edit goal" className={closeButton + " -my-1.5 -mr-2"}>
            <PencilIcon size={13} />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-mono tracking-[-.02em] tabular-nums">
          <span className="text-[34px] font-semibold text-accent">{p.count}</span>
          {p.target ? <span className="text-lg text-dim"> / {p.target}</span> : null}
          <span className="ml-2 font-sans text-[12.5px] text-muted">{goal.noun}</span>
        </div>
        <div className="text-[12.5px]">{current ? <Pace p={p} /> : p.target ? <Ended p={p} /> : null}</div>
      </div>

      {p.target ? (
        <GoalBar key={year} p={p} height={10} />
      ) : (
        <button type="button" onClick={onEdit} className={accentButton + " px-3.5 py-2 text-[12.5px]"}>
          Set a goal
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted tabular-nums">
        {goal.extra && p.extra > 0 && (
          <span>
            <span className="text-text2">{fmt(p.extra)}</span> <span className="font-sans">{goal.extra.label}</span>
          </span>
        )}
        {p.inProgress > 0 && (
          <span>
            <span className="text-text2">{p.inProgress}</span> <span className="font-sans">in progress</span>
          </span>
        )}
        {p.perMonth != null && (
          <span>
            <span className="text-text2">{p.perMonth < 10 ? p.perMonth.toFixed(1) : Math.ceil(p.perMonth)}</span> <span className="font-sans">a month to finish</span>
          </span>
        )}
      </div>

      {/* Each month's count; the dashed line is the even monthly pace the goal needs. */}
      <div className="relative mt-5 h-[72px]">
        {perMonth > 0 && (
          <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-wi" style={{ bottom: `calc(${(perMonth / top) * 56}px + 16px)` }} />
        )}
        <div className="absolute inset-0 grid grid-cols-12 items-end gap-1.5">
          {p.months.map((n, i) => {
            const future = current && i > month;
            return (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-1" title={`${MON[i]}: ${n}`}>
                <div
                  className="w-full max-w-[22px] rounded-[3px]"
                  style={{
                    height: n ? Math.max(4, (n / top) * 56) : 2,
                    background: n ? "var(--accent)" : "var(--chip)",
                    opacity: future ? 0.35 : n ? 0.9 : 1,
                  }}
                />
                <span className={"font-mono text-[10px] " + (current && i === month ? "text-text2" : "text-dim")}>{MON[i][0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-wd pt-3.5">
          {history.map((h) => (
            <button
              key={h.year}
              type="button"
              aria-pressed={year === h.year}
              onClick={() => onYear(year === h.year ? now : h.year)}
              className={toggleChip(year === h.year, "border-wf bg-chip text-muted2") + " rounded-md px-2 py-0.5 font-mono text-[11.5px]"}
            >
              {h.year} · {h.count}/{h.target}
              {h.met && " ✓"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** How a past year's goal ended. */
function Ended({ p }: { p: GoalProgress }) {
  if (!p.target) return null;
  if (p.count >= p.target) return <Pace p={p} />;
  return (
    <span className="text-muted2">
      <span className="font-mono font-semibold">{p.target - p.count}</span> <span>short</span>
    </span>
  );
}

/** Sets (or removes) one year's target. */
export function GoalDialog({ goal, goals, year, onClose }: { goal: GoalConfig; goals: GoalsApi; year: number; onClose(): void }) {
  const current = goals.goals?.[year];
  const [value, setValue] = useState(String(current ?? 24));
  const n = Math.floor(Number(value));
  const valid = Number.isFinite(n) && n > 0 && n <= 100000;
  const thisYear = year === new Date().getFullYear();
  const monthsLeft = thisYear ? 12 - new Date().getMonth() : 12;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    void goals.setGoal(year, n);
    onClose();
  };
  const step = (d: number) => setValue((v) => String(Math.max(1, (Math.floor(Number(v)) || 0) + d)));

  return (
    <Modal label={goal.label} onClose={onClose} width={400}>
      <form onSubmit={save}>
        <h2 className="m-0 mb-1 flex items-baseline gap-2 text-[17px] font-semibold tracking-[-.01em]">
          <span>{goal.label}</span>
          <span className="font-mono text-muted">{year}</span>
        </h2>
        <p className="m-0 mb-5 text-[13px] text-pretty text-muted2">{`How many ${goal.noun} do you want to ${goal.verb}?`}</p>

        <div className="mb-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => step(-1)} aria-label="One less" className={secondaryButton + " h-11 w-11 text-lg"}>
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`Number of ${goal.noun}`}
            autoFocus
            className="w-[120px] rounded-xl border border-wh bg-inset px-3 py-2 text-center font-mono text-[34px] font-semibold text-accent tabular-nums [appearance:textfield] focus:border-wi focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => step(1)} aria-label="One more" className={secondaryButton + " h-11 w-11 text-lg"}>
            +
          </button>
        </div>

        <div className="mb-4 flex justify-center gap-1.5">
          {PRESETS.map((v) => (
            <button key={v} type="button" aria-pressed={n === v} onClick={() => setValue(String(v))} className={toggleChip(n === v) + " rounded-lg px-3 py-1 font-mono text-xs"}>
              {v}
            </button>
          ))}
        </div>

        <p className="m-0 min-h-[18px] text-center font-mono text-xs text-dim tabular-nums">
          {valid && (
            <>
              ≈ {(n / 12 < 10 ? (n / 12).toFixed(1) : Math.round(n / 12)).toString()} <span className="font-sans">a month</span>
              {thisYear && monthsLeft < 12 && (
                <>
                  {" · "}
                  {monthsLeft} <span className="font-sans">{monthsLeft === 1 ? "month left" : "months left"}</span>
                </>
              )}
            </>
          )}
        </p>

        {goals.error && (
          <p role="alert" className="mt-3 mb-0 text-xs text-neg">
            {goals.error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-2">
          {current != null && (
            <button
              type="button"
              onClick={() => {
                void goals.setGoal(year, null);
                onClose();
              }}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-muted hover:text-neg"
            >
              Remove goal
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={secondaryButton + " px-4 py-2 text-[13px]"}>
            Cancel
          </button>
          <button type="submit" disabled={!valid} className={accentButton + " px-4 py-2 text-[13px]"}>
            {current != null ? "Save" : "Set goal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
