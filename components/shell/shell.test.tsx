// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_UID, TRIP_MEMBERS } from "@/config/libraries";

// ---- mocks: router, auth and supabase
const router = { push: vi.fn(), replace: vi.fn() };
let pathname = "/";
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));

const auth = {
  status: "signedIn" as const,
  user: { id: "someone", email: "me@example.com" } as { id: string; email: string } | null,
  submit: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

const rpc = vi.fn(async () => ({ data: { total_bytes: 1024 * 1024, users: [{ user_id: ADMIN_UID, email: "admin@x", bytes: 1024 }] }, error: null }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }), errorMessage: (e: { message?: string }) => e?.message ?? "err" }));

const { ShellProvider, useShell, libraryFromPath } = await import("./ShellProvider");
const { LibraryPicker } = await import("@/components/home/LibraryPicker");

function Opener() {
  const { openSettings } = useShell();
  return <button onClick={openSettings}>open-settings</button>;
}

const renderPicker = () =>
  render(
    <ShellProvider>
      <LibraryPicker />
      <Opener />
    </ShellProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  pathname = "/";
  auth.user = { id: "someone", email: "me@example.com" };
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const cardNames = () => screen.getAllByRole("button", { name: /Open →/ }).map((b) => b.textContent!.replace(/Open →.*/, "").trim());

describe("library picker", () => {
  it("shows every library except trips for a non-member", () => {
    renderPicker();
    expect(cardNames()).toEqual([
      expect.stringMatching(/^Games/), expect.stringMatching(/^Books/), expect.stringMatching(/^Wines/),
      expect.stringMatching(/^Movies/), expect.stringMatching(/^Expenses/),
    ]);
  });

  it("shows trips to trip members", () => {
    auth.user = { id: TRIP_MEMBERS[1], email: "bro@example.com" };
    renderPicker();
    expect(cardNames().at(-1)).toMatch(/^Trips/);
  });

  it("navigates behind the wipe: cover, push, reveal", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: /^Books/ }));
    expect(router.push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(430));
    expect(router.push).toHaveBeenCalledWith("/books/");
  });

  it("opens the only visible library right after sign-in", () => {
    localStorage.setItem("backlog:libs:someone", '["wines"]');
    localStorage.setItem("backlog:libsSeen:someone", '["games","books","wines","movies","expenses","trips"]');
    renderPicker();
    expect(router.replace).toHaveBeenCalledWith("/wines/");
  });
});

describe("settings", () => {
  it("toggles libraries, persists them with the legacy key, and keeps at least one", () => {
    renderPicker();
    fireEvent.click(screen.getByText("open-settings"));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    for (const name of ["Books", "Wines", "Movies", "Expenses", "Trips"]) {
      fireEvent.click(within(dialog).getByRole("switch", { name: new RegExp("^" + name) }));
    }
    expect(JSON.parse(localStorage.getItem("backlog:libs:someone")!)).toEqual(["games"]);
    expect(within(dialog).getByText("At least one library must stay visible.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("switch", { name: /^Games/ }));
    expect(JSON.parse(localStorage.getItem("backlog:libs:someone")!)).toEqual(["games"]);
    expect(cardNames()).toEqual([expect.stringMatching(/^Games/)]);
  });

  it("switches theme using the shared legacy key", () => {
    renderPicker();
    fireEvent.click(screen.getByText("open-settings"));
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(localStorage.getItem("backlog:theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("closes on Escape", () => {
    renderPicker();
    fireEvent.click(screen.getByText("open-settings"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows storage usage only to the admin", async () => {
    renderPicker();
    fireEvent.click(screen.getByText("open-settings"));
    expect(screen.queryByText("Administration")).toBeNull();
    cleanup();

    auth.user = { id: ADMIN_UID, email: "admin@x" };
    renderPicker();
    fireEvent.click(screen.getByText("open-settings"));
    await act(async () => {});
    expect(rpc).toHaveBeenCalledWith("admin_usage");
    expect(screen.getByText("Administration")).toBeTruthy();
    expect(screen.getByText("1.0 MB")).toBeTruthy();
  });
});

describe("libraryFromPath", () => {
  it.each([
    ["/", null], ["/games/", "games"], ["/trips/", "trips"], ["/dev/", null], [null, null],
  ])("%s → %s", (p, k) => expect(libraryFromPath(p)).toBe(k));
});
