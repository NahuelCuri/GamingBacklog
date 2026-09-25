// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { blankDraft, draftFromItem } from "@/lib/collection";
import type { CollectionKey, Item } from "@/lib/collection/types";
import { DEFAULT_URL_STATE, readUrlState, writeUrlState, type UrlState } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { usd } from "@/lib/spending";
import { seed } from "@/tests/legacy";
import { CollectionContext, type CollectionCtx } from "./CollectionContext";
import { ItemModal, type ModalState } from "./ItemModal";
import { LibraryView } from "./LibraryView";

afterEach(cleanup);

function makeCtx(key: CollectionKey, items: Item[], over: Partial<CollectionCtx> = {}) {
  const actions = { save: vi.fn(), remove: vi.fn(), loadStarter: vi.fn(), refresh: vi.fn() };
  const ctx: CollectionCtx = {
    collection: key, cfg: COLLECTIONS[key], data: { ...initialCollectionState, status: "ready", items }, items,
    actions: actions as never, money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: () => {},
    openAdd: vi.fn(), openEdit: vi.fn(), openShare: vi.fn(), openStatsImage: vi.fn(), ...over,
  };
  return { ctx, actions };
}

/** Renders LibraryView with URL state held in React state, like the real page. */
function renderLibrary(key: CollectionKey, items: Item[]) {
  const { ctx, actions } = makeCtx(key, items);
  function Harness() {
    const [url, setUrlState] = useState<UrlState>(DEFAULT_URL_STATE);
    const setUrl = (p: Partial<UrlState> | ((s: UrlState) => Partial<UrlState>)) => setUrlState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
    return (
      <CollectionContext.Provider value={{ ...ctx, url, setUrl }}>
        <LibraryView />
      </CollectionContext.Provider>
    );
  }
  render(<Harness />);
  return { ctx, actions };
}

const rowButtons = () => screen.queryAllByRole("button", { name: / — (expand|collapse) details$/ });
const rowTitles = () => rowButtons().map((r) => r.getAttribute("aria-label")!.replace(/ — .*$/, ""));

describe("library view (games seed)", () => {
  const games = seed("games");

  it("shows the metric strip and one row per game", () => {
    renderLibrary("games", games);
    expect(screen.getByText("games")).toBeTruthy();
    expect(rowButtons()).toHaveLength(games.length);
  });

  it("pages long libraries at 150 rows", () => {
    const many = Array.from({ length: 160 }, (_, i) => ({ ...games[i % games.length], id: "p" + i }));
    renderLibrary("games", many);
    expect(rowButtons()).toHaveLength(150);
    fireEvent.click(screen.getByRole("button", { name: /Showing 150 of 160 · load 10 more/ }));
    expect(rowButtons()).toHaveLength(160);
  });

  it("searches, filters by status and sorts by title", () => {
    renderLibrary("games", games);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your library" }), { target: { value: "plague" } });
    expect(rowTitles()).toEqual(games.filter((g) => /plague/i.test(String(g.title))).map((g) => g.title));

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.click(screen.getByRole("button", { name: "Playing" }));
    expect(rowTitles().length).toBe(games.filter((g) => g.status === "playing").length);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Title" }));
    const titles = rowTitles();
    expect(titles).toEqual([...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });

  it("expands a row with details and needs two clicks to delete", () => {
    const { actions } = renderLibrary("games", games);
    const first = rowButtons()[0];
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    const panel = first.nextElementSibling as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm?" }));
    expect(actions.remove).toHaveBeenCalledTimes(1);
  });

  it("clicking a tag chip filters by that tag", () => {
    renderLibrary("games", games);
    const tag = String((games.find((g) => (g.tags as string[])?.length)!.tags as string[])[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Filter by tag " + tag })[0]);
    expect(screen.getByRole("button", { name: "Remove tag " + tag })).toBeTruthy();
    expect(rowTitles().length).toBe(games.filter((g) => (g.tags as string[] | undefined)?.includes(tag)).length);
  });

  it("offers the starter set when the library is empty", () => {
    const { actions } = renderLibrary("games", []);
    fireEvent.click(screen.getByRole("button", { name: "Load starter set" }));
    expect(actions.loadStarter).toHaveBeenCalled();
  });
});

describe("library view (expenses seed)", () => {
  it("caps the ledger to the latest month until 'Load all'", () => {
    const tx = seed("expenses");
    renderLibrary("expenses", tx);
    const loadAll = screen.getByRole("button", { name: /Load all \d+ transactions/ });
    const before = rowButtons().length;
    expect(before).toBeLessThan(tx.length);
    fireEvent.click(loadAll);
    expect(rowButtons().length).toBe(Math.min(150, tx.length));
  });
});

// ---------------------------------------------------------------- modal

function renderModal(key: CollectionKey, initial: ModalState, items: Item[] = []) {
  const { ctx, actions } = makeCtx(key, items);
  const onClose = vi.fn();
  function Harness() {
    const [modal, setModal] = useState<ModalState | null>(initial);
    return (
      <CollectionContext.Provider value={ctx}>
        {modal ? <ItemModal modal={modal} setModal={setModal} onClose={onClose} /> : null}
      </CollectionContext.Provider>
    );
  }
  render(<Harness />);
  return { actions, onClose, ctx };
}

describe("item modal", () => {
  it("adds a game: needs a title, adds tags, saves a normalized item", () => {
    const { actions, onClose } = renderModal("games", { mode: "add", draft: blankDraft(COLLECTIONS.games) });
    const dialog = screen.getByRole("dialog", { name: "Add game" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add game" }));
    expect(actions.save).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), { target: { value: "  Hades  " } });
    const tagInput = within(dialog).getByRole("textbox", { name: "Tags — add a tag" });
    fireEvent.change(tagInput, { target: { value: "Roguelike" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Score /10" }), { target: { value: "9.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Steam" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add game" }));

    expect(actions.save).toHaveBeenCalledTimes(1);
    expect(actions.save.mock.calls[0][0]).toMatchObject({ title: "Hades", tags: ["Roguelike"], score: 9.5, platform: "Steam", status: "backlog", hours: null });
    expect(onClose).toHaveBeenCalled();
  });

  it("warns about duplicate titles", () => {
    const games = seed("games");
    renderModal("games", { mode: "add", draft: { ...blankDraft(COLLECTIONS.games), title: String(games[0].title).toUpperCase() } }, games);
    expect(screen.getByText(/is already in your backlog/)).toBeTruthy();
  });

  it("expenses: the account group appears only for transfers and is cleared when hidden", () => {
    const tx = seed("expenses");
    const transfer = tx.find((t) => t.type === "transfer" && t.account)!;
    const { actions } = renderModal("expenses", { mode: "edit", draft: draftFromItem(COLLECTIONS.expenses, transfer) }, tx);
    const dialog = screen.getByRole("dialog", { name: "Edit transaction" });
    const accountBtn = within(dialog).getByRole("button", { name: String(transfer.account), hidden: true });
    expect(accountBtn.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(dialog).getByRole("button", { name: "Expense" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(actions.save.mock.calls[0][0]).toMatchObject({ id: transfer.id, type: "expense", account: "" });
  });

  it("edit: delete needs confirmation", () => {
    const g = seed("games")[0];
    const { actions } = renderModal("games", { mode: "edit", draft: draftFromItem(COLLECTIONS.games, g) });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(actions.remove).toHaveBeenCalledWith(g.id);
  });

  it("closes on Escape", async () => {
    vi.useFakeTimers();
    const { onClose } = renderModal("games", { mode: "add", draft: blankDraft(COLLECTIONS.games) });
    act(() => vi.advanceTimersByTime(50));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------- url state

describe("url state", () => {
  it("round-trips view and filters and keeps unrelated params", () => {
    const s: UrlState = { view: "stats", q: "zelda", status: "played", catFilter: "Food", tagFilters: ["RPG", "Open World"] };
    const qs = writeUrlState("?x=1", s);
    expect(qs).toContain("x=1");
    expect(readUrlState(qs)).toEqual(s);
    expect(writeUrlState("", DEFAULT_URL_STATE)).toBe("");
    expect(readUrlState("?view=bogus").view).toBe("library");
  });
});
