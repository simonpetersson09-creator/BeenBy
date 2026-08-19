/**
 * Integration points for native capabilities (Capacitor).
 *
 * These are intentionally NOT faked in the web preview. Each function reports
 * whether the capability is available so the UI can degrade gracefully:
 * location and notifications are enhancements, never requirements.
 */

import { getLang, translate } from "@/lib/i18n";

export type NativeCapability =
  | "background-geofencing"
  | "local-notifications"
  | "push-notifications"
  | "deep-links"
  | "share-sheet";

export function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);
}

export function isCapabilityAvailable(capability: NativeCapability): boolean {
  if (capability === "share-sheet") {
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
  }
  return isNativeRuntime();
}

/** Native share sheet with a clipboard fallback. Returns how it was shared. */
export async function shareInvite(url: string, text: string): Promise<"shared" | "copied"> {
  const { shareLink } = await import("@/lib/share");
  return await shareLink({ title: translate(getLang(), "invite.subject"), text, url });
}

/**
 * One-shot location check against the visited person's saved coordinates.
 * Used only as a reference point — we never store or share the user's position.
 */
export async function distanceToPerson(
  lat: number,
  lng: number,
): Promise<{ ok: true; meters: number } | { ok: false; reason: "unsupported" | "denied" | "error" }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unsupported" };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ ok: true, meters: haversine(pos.coords.latitude, pos.coords.longitude, lat, lng) });
      },
      (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? "denied" : "error" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Background geofencing and notifications require a native build. Calling these
 * in the web preview is a no-op that reports the capability as unavailable,
 * so nothing pretends to work that doesn't.
 */
export function registerGeofence(): { registered: false; reason: string } {
  return { registered: false, reason: translate(getLang(), "native.requiresApp") };
}

export function scheduleLocalNotification(): { scheduled: false; reason: string } {
  return { scheduled: false, reason: translate(getLang(), "native.requiresApp") };
}
