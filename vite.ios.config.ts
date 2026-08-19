/**
 * Static client-only build for Capacitor / iOS.
 *
 *   npm run build:ios  ->  dist/client/{index.html, assets/*}
 *
 * The web deploy is untouched: `npm run build` still runs the TanStack Start /
 * Nitro / Cloudflare SSR build via vite.config.ts.
 */
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const apiRoutesDir = fileURLToPath(new URL("./src/routes/api/", import.meta.url));

function stubServerRoutes() {
  return {
    name: "beenby:stub-server-routes",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      appendFileSync("/tmp/trace.log", `${importer ?? "-"} >> ${source}\n`);
      return null;
    },
    load(id: string) {
      const file = id.split("?")[0] ?? id;
      if (!file.startsWith(apiRoutesDir) || !/\.tsx?$/.test(file)) return null;
      const routePath = `/${file.slice(apiRoutesDir.length).replace(/\.tsx?$/, "")}`;
      return [
        `import { createFileRoute } from "@tanstack/react-router";`,
        `export const Route = createFileRoute("/api${routePath}")({});`,
      ].join("\n");
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL("./capacitor", import.meta.url)),
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envDir: projectRoot,
  plugins: [stubServerRoutes(), tsconfigPaths({ root: projectRoot }), react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_IOS_SPA": JSON.stringify("true"),
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
