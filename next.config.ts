import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/paths";

const isDev = process.env.NODE_ENV === "development";

// Static export for GitHub Pages: https://nahuelcuri.github.io/GamingBacklog/
const nextConfig: NextConfig = {
  // Export only on build; in dev this lets the redirect below work.
  output: isDev ? undefined : "export",
  // Lets a production build run next to a live `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  basePath: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  // Dev convenience: localhost:3000/ → /GamingBacklog/ instead of a 404.
  ...(isDev && {
    redirects: async () => [
      { source: "/", destination: BASE_PATH + "/", basePath: false, permanent: false },
    ],
  }),
};

export default nextConfig;
