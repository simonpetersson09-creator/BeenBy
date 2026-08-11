/**
 * Step 6 — ties the existing geofence machinery to a single user setting.
 *
 * Nothing here re-implements geofencing or visits: it only decides WHETHER a
 * region should be monitored right now, and reconciles that desire with the
 * regions iOS is actually monitoring.
 *
 * Desired state = user preference (family_members.geofence_enabled)
 *               + Premium/trial access
 *               + saved coordinates on the person
 *               + Always location permission
 *               + notification permission
 *
 * On web every native call short-circuits (see geofence.ts), so syncing is a
 * no-op and can never crash the preview.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_GEOFENCE_RADIUS,
  geofenceIdentifier,
  getGeofenceNotificationPermissionStatus,
  getGeofencePermissionStatus,
  getMonitoredGeofences,
  isNativeGeofenceAvailable,
  requestGeofenceNotificationPermission,
  requestGeofencePermissions,
  startGeofence,
  stopGeofence,
} from "@/lib/geofence";

export type GeofencePerson = {
  id: string;
  name: string;
  location_latitude: number | null;
  location_longitude: number | null;
  geofence_radius?: number | null;
};

export type GeofenceBlockReason =
  | "not-native"
  | "no-access"
  | "no-address"
  | "location-denied"
  | "location-missing"
  | "notifications-denied";

export type GeofenceSyncResult = {
  /** true when a region is monitored for this person after the sync. */
  active: boolean;
  /** Why it is not active, when it is not. */
  reason?: GeofenceBlockReason;
};

/** Reads this user's saved preference for the given circle. */
export async function getGeofencePreference(
  circleId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("family_members")
    .select("geofence_enabled")
    .eq("family_circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean(data.geofence_enabled);
}

/** Persists the preference. The native region is handled by syncGeofenceState. */
export async function setGeofencePreference(
  circleId: string,
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("family_members")
    .update({ geofence_enabled: enabled })
    .eq("family_circle_id", circleId)
    .eq("user_id", userId);
  return !error;
}

/**
 * Permission flow, only ever triggered by the user turning the toggle on:
 * When In Use → Always → notifications. Never called at app start.
 */
export async function ensureGeofencePermissions(): Promise<
  { ok: true } | { ok: false; reason: GeofenceBlockReason }
> {
  if (!isNativeGeofenceAvailable()) return { ok: false, reason: "not-native" };

  let location = await getGeofencePermissionStatus();
  if (location.status === "notDetermined") {
    location = await requestGeofencePermissions({ always: true });
  } else if (location.status === "whenInUse") {
    location = await requestGeofencePermissions({ always: true });
  }
  if (location.status === "denied" || location.status === "restricted") {
    return { ok: false, reason: "location-denied" };
  }
  if (location.status !== "always") {
    // whenInUse / notDetermined — background arrival detection needs Always.
    return { ok: false, reason: "location-missing" };
  }

  let notifications = await getGeofenceNotificationPermissionStatus();
  if (notifications === "notDetermined") {
    notifications = await requestGeofenceNotificationPermission();
  }
  if (notifications === "denied") return { ok: false, reason: "notifications-denied" };

  return { ok: true };
}

/**
 * Reconciles wanted vs actual native state. Safe to call as often as needed —
 * it starts at most one region per person and removes every other BeenBy
 * region, so duplicates cannot build up.
 */
export async function syncGeofenceState(options: {
  circleId: string;
  userId: string;
  person: GeofencePerson | null;
  hasAccess: boolean;
  /** Skip the DB read when the caller already knows the preference. */
  enabled?: boolean;
}): Promise<GeofenceSyncResult> {
  const { circleId, userId, person, hasAccess } = options;

  if (!isNativeGeofenceAvailable()) return { active: false, reason: "not-native" };

  const enabled =
    options.enabled ?? (await getGeofencePreference(circleId, userId));

  const hasCoords =
    !!person && person.location_latitude != null && person.location_longitude != null;

  let reason: GeofenceBlockReason | undefined;
  let wanted = enabled;
  if (!hasAccess) {
    wanted = false;
    reason = "no-access";
  } else if (!hasCoords) {
    wanted = false;
    reason = "no-address";
  } else {
    const location = await getGeofencePermissionStatus();
    if (location.status === "denied" || location.status === "restricted") {
      wanted = false;
      reason = "location-denied";
    } else if (location.status !== "always") {
      wanted = false;
      reason = "location-missing";
    } else if ((await getGeofenceNotificationPermissionStatus()) === "denied") {
      wanted = false;
      reason = "notifications-denied";
    }
  }

  const identifier = person ? geofenceIdentifier(circleId, person.id) : null;
  const monitored = await getMonitoredGeofences();

  // Remove every BeenBy region that is not the one we want right now — this is
  // also how an address change and a person change are handled.
  for (const region of monitored) {
    if (!region.identifier.startsWith("beenby:")) continue;
    const isTarget = identifier !== null && region.identifier === identifier;
    const coordsMatch =
      isTarget &&
      person != null &&
      Math.abs(region.latitude - (person.location_latitude ?? 0)) < 1e-6 &&
      Math.abs(region.longitude - (person.location_longitude ?? 0)) < 1e-6;
    if (!wanted || !isTarget || !coordsMatch) {
      await stopGeofence(region.identifier);
    }
  }

  if (!wanted || !identifier || !person) {
    return { active: false, ...(reason ? { reason } : {}) };
  }

  const already = monitored.some(
    (r) =>
      r.identifier === identifier &&
      Math.abs(r.latitude - (person.location_latitude ?? 0)) < 1e-6 &&
      Math.abs(r.longitude - (person.location_longitude ?? 0)) < 1e-6,
  );
  if (already) return { active: true };

  const result = await startGeofence({
    identifier,
    familyCircleId: circleId,
    personId: person.id,
    personName: person.name,
    latitude: person.location_latitude as number,
    longitude: person.location_longitude as number,
    radius: person.geofence_radius ?? DEFAULT_GEOFENCE_RADIUS,
  });
  return result.started ? { active: true } : { active: false, reason: "location-missing" };
}

/** Best-effort deep link into the iOS Settings app. Never throws. */
export async function openNativeSettings(): Promise<boolean> {
  if (!isNativeGeofenceAvailable()) return false;
  try {
    const { App } = await import("@capacitor/app");
    await App.openUrl({ url: "app-settings:" });
    return true;
  } catch {
    return false;
  }
}
