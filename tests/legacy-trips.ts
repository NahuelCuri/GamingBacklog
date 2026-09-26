// Loads the legacy Trip Planner component class (legacy-src/Trip Planner.dc.html)
// into a Node VM with a minimal DCLogic/React stand-in, so parity tests can call
// its methods and renderVals() directly.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = fs.readFileSync(path.join(__dirname, "..", "legacy-src", "Trip Planner.dc.html"), "utf8");
const src = html.slice(html.indexOf("class Component extends DCLogic"), html.lastIndexOf("</script>"));

export function legacyPlanner(state: Record<string, unknown> = {}, props: Record<string, unknown> = {}): any {
  const store: Record<string, string> = {};
  const ctx: any = {
    window: { innerWidth: 1200 },
    document: { querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] },
    React: { createElement: () => null, createRef: () => ({ current: null }) },
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(
    `class DCLogic {
       constructor(props) { this.props = props || {}; }
       setState(p, cb) { const patch = typeof p === 'function' ? p(this.state) : p; if (patch) this.state = Object.assign({}, this.state, patch); if (cb) cb(); }
       forceUpdate() {}
     }
     ${src}
     globalThis.Component = Component;`,
    ctx,
  );
  const c = new ctx.Component(props);
  c.props = props;
  c.state = { ...c.state, ...state };
  return c;
}

/** Cross-realm, function-free copy. */
export const plain = <T = any>(v: unknown): T => (v === undefined ? (v as T) : JSON.parse(JSON.stringify(v)));
