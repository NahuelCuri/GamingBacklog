// Site base path on GitHub Pages (https://nahuelcuri.github.io/GamingBacklog/).
// next/link and next/router add it automatically; plain URLs (fetch, <a>) need it.
export const BASE_PATH = "/GamingBacklog";

export const withBase = (path: string) => BASE_PATH + (path.startsWith("/") ? path : "/" + path);
