/**
 * Static client-only build for Capacitor / iOS.
 *
 *   npm run build:ios  ->  dist/client/{index.html, assets/*}
 *
 * The web deploy is untouched: `npm run build` still runs the TanStack Start /
 * Nitro / Cloudflare SSR build via vite.config.ts.
 */
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./capacitor", import.meta.url)),
  // Relative asset URLs so the bundle works under capacitor:// / file:// origins.
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envDir: projectRoot,
  plugins: [tsconfigPaths({ root: projectRoot }), react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_IOS_SPA": JSON.stringify("true"),
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
