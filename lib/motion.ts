// Motion helpers for one-shot animations started from script. The CSS
// reduced-motion override in globals.css doesn't reach the Web Animations API,
// so everything scripted goes through `play`, which checks it first.

/** Same curve as --ease-out in globals.css. */
export const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches;

/** Element.animate, or null when there's no element, no WAAPI (jsdom) or the user asked for reduced motion. */
export function play(el: Element | null | undefined, keyframes: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof el.animate !== "function" || reducedMotion()) return null;
  return el.animate(keyframes, { easing: EASE_OUT, fill: "backwards", ...opts });
}

/** One-shot highlight of an overlay (opacity 0 at rest) marking a just-edited row. */
export const flash = (el: Element | null | undefined) =>
  play(el, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 900, easing: "ease-out" });
