import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig keeps JSX for Next ("preserve"); tests need the React 17+ runtime.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", "legacy-src/**", ".next/**", ".next-*/**", "out/**"],
  },
});
