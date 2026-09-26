// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { ES } from "./es";
import { createTranslator, translate } from "./translator";

function legacyDict(): Record<string, string> {
  const ctx = { window: {} as { BLI18N?: { dict: Record<string, string> } }, document: { readyState: "loading", addEventListener() {} }, localStorage: { getItem: () => null } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../legacy-src/i18n.js"), "utf8"), ctx);
  return JSON.parse(JSON.stringify(ctx.window.BLI18N!.dict));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("i18n", () => {
  it("uses the legacy dictionary", () => {
    expect({ ...ES }).toEqual(legacyDict());
  });

  it("matches the trimmed text and keeps whitespace", () => {
    expect(translate("  Library ")).toBe("  Biblioteca ");
    expect(translate("Library of Babel")).toBeNull();
    expect(translate("No books match.")).toBe("Ningún libro coincide.");
    expect(translate("Ningún libro coincide.")).toBeNull(); // maps to itself
  });

  it("translates text, placeholders and titles; skips brands and textareas; restores EN", () => {
    document.body.innerHTML = `
      <h1><span data-no-i18n>Backlog</span> <span translate="no">Books</span></h1>
      <button title="Sign out">Sign out</button>
      <input placeholder="Book title">
      <textarea>Notes</textarea>
      <p>Status: <b>Reading</b> and more</p>`;
    const t = createTranslator(document.body);
    t.setLang("es");
    expect(document.body.textContent).toContain("Backlog");
    expect(document.body.textContent).toContain("Books");
    expect(document.querySelector("button")!.outerHTML).toBe('<button title="Cerrar sesión">Cerrar sesión</button>');
    expect(document.querySelector("input")!.placeholder).toBe("Título del libro");
    expect(document.querySelector("textarea")!.textContent).toBe("Notes");
    expect(document.querySelector("b")!.textContent).toBe("Leyendo");
    expect(document.documentElement.lang).toBe("es");

    t.setLang("en");
    expect(document.querySelector("button")!.outerHTML).toBe('<button title="Sign out">Sign out</button>');
    expect(document.querySelector("input")!.placeholder).toBe("Book title");
    expect(document.querySelector("b")!.textContent).toBe("Reading");
    t.stop();
  });

  it("follows DOM updates while in Spanish", async () => {
    document.body.innerHTML = `<p id="p">Other</p>`;
    const t = createTranslator(document.body);
    t.setLang("es");
    const p = document.getElementById("p")!;
    expect(p.textContent).toBe("Otros");

    p.firstChild!.nodeValue = "Food"; // a re-render changing the text
    await flush();
    expect(p.textContent).toBe("Comida");

    const added = document.createElement("span");
    added.textContent = "Housing";
    added.title = "Transport";
    document.body.appendChild(added);
    await flush();
    expect(added.outerHTML).toBe('<span title="Transporte">Vivienda</span>');

    // Switching back restores only what is still our translation.
    p.firstChild!.nodeValue = "Food";
    t.setLang("en");
    expect(p.textContent).toBe("Food");
    expect(added.textContent).toBe("Housing");
    t.stop();
  });
});
