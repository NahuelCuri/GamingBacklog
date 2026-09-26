// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./CountUp";

// Drive requestAnimationFrame by hand so each frame lands at a known time.
let frames: FrameRequestCallback[] = [];
const flush = (now: number) => {
  const run = frames;
  frames = [];
  run.forEach((f) => f(now));
};

function setReduced(reduced: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduced && q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it("counts a formatted value up from 0 and ends on the exact text", () => {
    setReduced(false);
    const { container } = render(<CountUp value="$1,234.50" duration={600} />);
    expect(container.textContent).toBe("$0.00");
    act(() => flush(1));
    act(() => flush(301));
    const mid = Number(container.textContent!.replace(/[$,]/g, ""));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1234.5);
    act(() => flush(700));
    expect(container.textContent).toBe("$1,234.50");
  });

  it("counts from the previous value when it changes", () => {
    setReduced(false);
    const { container, rerender } = render(<CountUp value="40%" />);
    act(() => flush(1));
    act(() => flush(1000));
    rerender(<CountUp value="80%" />);
    expect(container.textContent).toBe("40%");
    act(() => flush(2000));
    act(() => flush(3000));
    expect(container.textContent).toBe("80%");
  });

  it("shows the final value at once with reduced motion", () => {
    setReduced(true);
    const { container } = render(<CountUp value="148" />);
    expect(container.textContent).toBe("148");
    expect(frames).toHaveLength(0);
  });

  it("leaves text it can't parse alone", () => {
    setReduced(false);
    const { container } = render(<CountUp value="12 days" />);
    expect(container.textContent).toBe("12 days");
    expect(frames).toHaveLength(0);
  });
});
