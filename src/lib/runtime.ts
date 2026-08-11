/**
 * Build-target flags.
 *
 * VITE_IOS_SPA is only defined by `npm run build:ios` (vite.ios.config.ts), which
 * produces the static client bundle that Capacitor ships inside the iOS app.
 * In that build there is no Nitro/TanStack server available on the device.
 */
export const IS_NATIVE_SPA = import.meta.env["VITE_IOS_SPA"] === "true";
