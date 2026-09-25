import type { NextConfig } from "next";

// Static export for GitHub Pages: https://nahuelcuri.github.io/GamingBacklog/
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/GamingBacklog",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
