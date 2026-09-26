// Serves the static export (out/) exactly like GitHub Pages does:
// under /GamingBacklog/, directories resolve to index.html, misses → 404.html.
// Usage: npm run preview  (builds first)   →  http://localhost:4173/GamingBacklog/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const BASE = "/GamingBacklog";
const OUT = join(import.meta.dirname, "..", "out");
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function resolve(urlPath) {
  const file = normalize(join(OUT, decodeURIComponent(urlPath)));
  if (!file.startsWith(OUT)) return null;
  try {
    const s = await stat(file);
    if (s.isFile()) return file;
    if (s.isDirectory()) {
      const index = join(file, "index.html");
      if ((await stat(index)).isFile()) return index;
    }
  } catch {}
  return null;
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/" || path === BASE) {
    res.writeHead(302, { Location: BASE + "/" }).end();
    return;
  }
  if (!path.startsWith(BASE + "/")) {
    res.writeHead(404).end("Not under " + BASE);
    return;
  }
  const rel = path.slice(BASE.length);
  // Pages redirects /dir → /dir/ when dir has an index.html
  if (!rel.endsWith("/") && !extname(rel) && (await resolve(rel + "/"))) {
    res.writeHead(301, { Location: path + "/" }).end();
    return;
  }
  const file = (await resolve(rel)) ?? join(OUT, "404.html");
  const status = file.endsWith("404.html") && !rel.endsWith("404.html") ? 404 : 200;
  try {
    const body = await readFile(file);
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Preview: http://localhost:${PORT}${BASE}/`);
});
