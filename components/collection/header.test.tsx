// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { DEFAULT_URL_STATE } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { usd } from "@/lib/spending";
import { seed } from "@/tests/seeds";

const signOut = vi.fn();
vi.mock("@/components/shell/ShellProvider", () => ({ useShell: () => ({ libs: ["games", "books"], navigate: vi.fn(), openSettings: vi.fn() }) }));
const downloadAll = vi.fn(async () => {});
vi.mock("@/lib/data/transfer", async (orig) => ({ ...(await orig<typeof import("@/lib/data/transfer")>()), downloadAll }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "me@example.com" }, signOut }) }));

const { CollectionContext } = await import("./CollectionContext");
const { CollectionHeader } = await import("./CollectionHeader");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderHeader(status: "ready" | "loading" = "ready") {
  const items = seed("games");
  const actions = { exportNow: vi.fn(), importReplace: vi.fn(async () => {}), importMerge: vi.fn(async () => {}) };
  render(
    <CollectionContext.Provider
      value={{
        collection: "games", cfg: COLLECTIONS.games, data: { ...initialCollectionState, status, items }, items,
        actions: actions as never, money: usd, isMobile: false, url: DEFAULT_URL_STATE, setUrl: () => {},
        openAdd: vi.fn(), openEdit: vi.fn(), openShare: vi.fn(), openStatsImage: vi.fn(),
      }}
    >
      <CollectionHeader />
    </CollectionContext.Provider>,
  );
  return { actions, items };
}

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  return screen.getByRole("menu");
};

describe("collection header menu", () => {
  it("holds export, import and sign out; Escape closes it and returns focus", () => {
    renderHeader();
    const menu = openMenu();
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Export", "Import", "Sign out"]);
    expect(document.activeElement?.textContent).toBe("Export");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe("Sign out");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions" }));

    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Export" }));
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Export backup" })).getByRole("button", { name: "Cancel" }));

    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("disables export and import until the library has loaded", () => {
    renderHeader("loading");
    const menu = openMenu();
    expect((within(menu).getByRole("menuitem", { name: "Export" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(menu).getByRole("menuitem", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("collection header export", () => {
  it("offers every visible library with the open one picked, and downloads the picked ones", async () => {
    const { items } = renderHeader();
    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Export" }));
    const dialog = screen.getByRole("dialog", { name: "Export backup" });
    const boxes = within(dialog).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.closest("label")!.textContent)).toEqual(["Games", "Books"]);
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(downloadAll).toHaveBeenCalled());
    const files = (downloadAll.mock.calls[0] as unknown as [{ key: string; json: string }[]])[0];
    expect(files.map((f) => f.key)).toEqual(["games"]);
    expect(JSON.parse(files[0].json)).toEqual(items);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("collection header import", () => {
  it("lists changed items with their old and new values", async () => {
    const { items } = renderHeader();
    const edited = { ...items[0], title: "Renamed" };
    pick(JSON.stringify([edited]));
    const dialog = await screen.findByRole("dialog", { name: "Import backup" });
    expect(dialog.textContent).toContain("~1 changed");
    const old = String(items[0].title);
    expect(dialog.textContent).toContain(`Title: ${old.length > 28 ? old.slice(0, 27) + "…" : old} → Renamed`);
  });

  const pick = (json: string) =>
    fireEvent.change(screen.getByLabelText("Import backup JSON file"), {
      target: { files: [new File([json], "backup.json", { type: "application/json" })] },
    });

  it("asks in a dialog, adds by default, and Cancel keeps the data", async () => {
    const { actions, items } = renderHeader();
    const file = [...items.slice(0, 3), { id: "brand-new" }];
    pick(JSON.stringify(file));
    const dialog = await screen.findByRole("dialog", { name: "Import backup" });
    expect((within(dialog).getByRole("radio", { name: /Add to library/ }) as HTMLInputElement).checked).toBe(true);
    expect(dialog.textContent).toContain("+1 new · ~0 changed · 3 unchanged");
    expect(dialog.textContent).not.toMatch(/−\d+ deleted/);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.importMerge).not.toHaveBeenCalled();

    pick(JSON.stringify(file));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Import" }));
    await waitFor(() => expect(actions.importMerge).toHaveBeenCalledWith(file));
    expect(actions.importReplace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("replaces only when that option is picked", async () => {
    const { actions, items } = renderHeader();
    pick(JSON.stringify(items.slice(0, 3)));
    const dialog = await screen.findByRole("dialog", { name: "Import backup" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Replace everything/ }));
    expect(dialog.textContent).toContain(`−${items.length - 3} deleted`);
    fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(actions.importReplace).toHaveBeenCalledWith(items.slice(0, 3)));
    expect(actions.importMerge).not.toHaveBeenCalled();
  });

  it("shows a parse error inline without opening the dialog", async () => {
    renderHeader();
    pick("not json");
    expect((await screen.findByRole("alert")).textContent).toBe("The file is not valid JSON.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
