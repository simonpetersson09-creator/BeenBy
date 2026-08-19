/**
 * Client-only stub for `@tanstack/react-start/server`.
 *
 * The TanStack Start Vite plugin normally strips server-only code (middleware
 * `.server()` bodies, server routes) out of the browser bundle. The Capacitor
 * SPA build (vite.ios.config.ts) runs without that plugin, so those modules
 * would pull `@tanstack/start-server-core` — and its plugin-only virtual
 * imports such as `#tanstack-start-entry` — into the browser graph, which
 * fails the build.
 *
 * Nothing here ever runs on device: the code paths that reference these
 * helpers only execute on the server.
 */
function serverOnly(name: string): never {
  throw new Error(`${name}() is server-only and is not available in the native app bundle`);
}

export const getRequest = () => serverOnly("getRequest");
export const getRequestHeaders = () => serverOnly("getRequestHeaders");
export const getRequestHeader = () => serverOnly("getRequestHeader");
export const getResponseHeaders = () => serverOnly("getResponseHeaders");
export const setResponseHeader = () => serverOnly("setResponseHeader");
export const setResponseStatus = () => serverOnly("setResponseStatus");
export const getEvent = () => serverOnly("getEvent");
export const createStartHandler = () => serverOnly("createStartHandler");
export const defaultStreamHandler = () => serverOnly("defaultStreamHandler");
export const defaultRenderHandler = () => serverOnly("defaultRenderHandler");
