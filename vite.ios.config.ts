/**
 * Static client-only build for Capacitor / iOS.
 *
 *   npm run build:ios  ->  dist/client/{index.html, assets/*}
 *
 * The web deploy is untouched: `npm run build` still runs the TanStack Start /
 * Nitro / Cloudflare SSR build via vite.config.ts.
 *
 * This build deliberately runs WITHOUT the TanStack Start Vite plugin (there is
 * no server on the device). The plugin is what normally removes server-only
 * code from the client bundle, so we reproduce the two pieces we need:
 *   1. server routes (src/routes/api/**) are replaced by inert client routes,
 *   2. `@tanstack/react-start/server` resolves to a stub.
 * Without this, `@tanstack/start-server-core` ends up in the browser graph and
 * the build fails with:
 *   Missing "#tanstack-start-entry" specifier in "@tanstack/start-server-core"
 */
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const apiRoutesDir = fileURLToPath(new URL("./src/routes/api/", import.meta.url));

/** Replace TanStack server routes with inert client routes for the SPA build. */
function stubServerRoutes() {
  return {
    name: "beenby:stub-server-routes",
    enforce: "pre" as const,
    load(id: string) {
      const file = id.split("?")[0] ?? id;
      if (!file.startsWith(apiRoutesDir) || !/\.tsx?$/.test(file)) return null;
      const routePath = file.slice(apiRoutesDir.length).replace(/\.tsx?$/, "");
      return [
        `import { createFileRoute } from "@tanstack/react-router";`,
        `export const Route = createFileRoute("/api/${routePath}")({});`,
      ].join("\n");
    },
  };
}

/**
 * Keep every server-only module out of the app bundle.
 *
 * `*.server.ts` and `*.functions.ts` only ever run on BeenBy's backend. In the
 * native build the same work happens over authenticated HTTPS
 * (`src/lib/nativeApi.ts`), so the real modules are replaced by stubs that
 * throw if anything ever reaches them. This also stops the service-role
 * Supabase client from being emitted into a chunk the app ships.
 */
function stubServerModules() {
  return {
    name: "beenby:stub-server-modules",
    enforce: "pre" as const,
    load(id: string) {
      const file = id.split("?")[0] ?? id;
      if (!file.startsWith(projectRoot) || !/\.(server|functions)\.tsx?$/.test(file)) return null;

      const source = readFileSync(file, "utf8");
      const names = new Set<string>();
      const patterns = [
        /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
        /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
        /export\s+class\s+([A-Za-z0-9_$]+)/g,
      ];
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
          if (match[1]) names.add(match[1]);
        }
      }

      const relative = file.slice(projectRoot.length);
      const lines = [
        `const unavailable = (name) => { throw new Error("[beenby] ${relative}:" + name + " is server-only and is not available in the native app"); };`,
        ...[...names].map((name) => `export const ${name} = (...args) => unavailable("${name}");`),
        `export default {};`,
      ];
      return lines.join("\n");
    },
  };
}


export default defineConfig({
  root: fileURLToPath(new URL("./capacitor", import.meta.url)),
  // Relative asset URLs so the bundle works under capacitor:// / file:// origins.
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envDir: projectRoot,
  plugins: [stubServerRoutes(), tsconfigPaths({ root: projectRoot }), react(), tailwindcss()],
  resolve: {
    alias: [
      {
        // The Start client runtime constructs an AsyncLocalStorage at import
        // time; without a real implementation the app crashes before render.
        find: /^(node:)?async_hooks$/,
        replacement: fileURLToPath(new URL("./capacitor/async-hooks-stub.ts", import.meta.url)),
      },
      {
        find: /^@tanstack\/react-start\/server$/,
        replacement: fileURLToPath(new URL("./capacitor/react-start-server-stub.ts", import.meta.url)),
      },
    ],
  },
  define: {
    "import.meta.env.VITE_IOS_SPA": JSON.stringify("true"),
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
