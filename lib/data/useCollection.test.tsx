// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { memoryStore } from "./store";
import { useCollection } from "./useCollection";

describe("useCollection", () => {
  it("finishes loading under StrictMode's double effects", async () => {
    const store = memoryStore([{ id: "1", title: "A" }]);
    const { result } = renderHook(() => useCollection("games", store), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.state.items).toHaveLength(1);
  });

  it("ignores a slow load from a store that was replaced", async () => {
    let release!: () => void;
    const slow = { ...memoryStore([{ id: "old" }]), load: () => new Promise<never[]>((r) => (release = () => r([]))) };
    const fresh = memoryStore([{ id: "new" }]);
    const { result, rerender } = renderHook(({ s }) => useCollection("games", s), { initialProps: { s: slow as never } });
    rerender({ s: fresh as never });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.state.items.map((x) => x.id)).toEqual(["new"]);
  });
});
