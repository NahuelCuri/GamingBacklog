// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/collections";
import { DEFAULT_URL_STATE } from "@/lib/collection/url-state";
import { initialCollectionState } from "@/lib/data/collection-state";
import { usd } from "@/lib/spending";
import { seed } from "@/tests/legacy";

const signOut = vi.fn();
vi.mock("@/components/shell/ShellProvider", () => ({ useShell: () => ({ libs: ["games"], navigate: vi.fn(), openSettings: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "me@example.com" }, signOut }) }));

const { CollectionContext } = await import("./CollectionContext");
const { CollectionHeader } = await import("./CollectionHeader");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderHeader(status: "ready" | "loading" = "ready") {
  const items = seed("games");
  const actions = { exportNow: vi.fn(), importReplace: vi.fn(async () => {}) };
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
    const { actions } = renderHeader();
    const menu = openMenu();
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Export", "Import", "Sign out"]);
    expect(document.activeElement?.textContent).toBe("Export");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe("Sign out");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions" }));

    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Export" }));
    expect(actions.exportNow).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();

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

describe("collection header import", () => {
  const pick = (json: string) =>
    fireEvent.change(screen.getByLabelText("Import backup JSON file"), {
      target: { files: [new File([json], "backup.json", { type: "application/json" })] },
    });

  it("asks in a dialog before replacing, and Cancel keeps the data", async () => {
    const { actions, items } = renderHeader();
    pick(JSON.stringify(items.slice(0, 3)));
    const dialog = await screen.findByRole("dialog", { name: "Replace library" });
    expect(dialog.textContent).toContain(`Replace your ${items.length} games with the 3 in this file?`);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.importReplace).not.toHaveBeenCalled();

    pick(JSON.stringify(items.slice(0, 3)));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(actions.importReplace).toHaveBeenCalledWith(items.slice(0, 3)));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a parse error inline without opening the dialog", async () => {
    renderHeader();
    pick("not json");
    expect((await screen.findByRole("alert")).textContent).toBe("The file is not valid JSON.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
