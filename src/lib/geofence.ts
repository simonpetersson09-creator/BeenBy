/**
 * TypeScript bridge to the native iOS BeenbyGeofence plugin (Core Location).
 *
 * Step 3 scope: permissions + region monitoring + event exposure only.
 * No notifications, no automatic visit registration, no Premium coupling.
 *
 * On web / Lovable preview the native plugin does not exist, so every call
 * short-circuits to a safe fallback and no real geofence is ever activated.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** Plugin name that the Swift implementation registers as. */
export const GEOFENCE_PLUGIN_NAME = "BeenbyGeofence";

export type GeofencePermissionStatus =
  | "notDetermined"
  | "whenInUse"
  | "always"
  | "denied"
  | "restricted";

export type PermissionResult = {
  status: GeofencePermissionStatus;
  /** iOS: whether CLCircularRegion monitoring is available at all. */
  monitoringAvailable?: boolean;
};

export type MonitoredRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export type StartRegionOptions = {
  identifier: string;
  latitude: number;
  longitude: number;
  /** Metres. Native clamps to maximumRegionMonitoringDistance. Default 150. */
  radius?: number;
};

export type StartRegionResult = {
  started: boolean;
  identifier: string;
  /** The radius iOS actually used after clamping. */
  radius?: number;
  message?: string;
};

export type GeofenceEnterEvent = {
  identifier: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
};

export type GeofenceErrorEvent = {
  identifier?: string;
  message: string;
};

export interface BeenbyGeofencePlugin {
  getPermissionStatus(): Promise<PermissionResult>;
  requestWhenInUsePermission(): Promise<PermissionResult>;
  requestAlwaysPermission(): Promise<PermissionResult>;
  startMonitoringRegion(options: StartRegionOptions): Promise<StartRegionResult>;
  stopMonitoringRegion(options: { identifier: string }): Promise<{ stopped: boolean; identifier: string }>;
  getMonitoredRegions(): Promise<{ regions: MonitoredRegion[] }>;
  addListener(
    eventName: "geofenceEnter",
    listener: (event: GeofenceEnterEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "geofenceError",
    listener: (event: GeofenceErrorEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "geofencePermissionChange",
    listener: (event: { status: GeofencePermissionStatus }) => void,
  ): Promise<PluginListenerHandle>;
}

export const BeenbyGeofence = registerPlugin<BeenbyGeofencePlugin>(GEOFENCE_PLUGIN_NAME);

/** Default BeenBy geofence radius in metres. */
export const DEFAULT_GEOFENCE_RADIUS = 150;

/** True when running inside the native iOS shell (Capacitor). */
export function isNativeGeofenceAvailable(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "ios" &&
      Capacitor.isPluginAvailable(GEOFENCE_PLUGIN_NAME)
    );
  } catch {
    return false;
  }
}

/**
 * Region identifier that ties an enter-event back to the exact person/circle.
 * Format: beenby:<familyCircleId>:<personId>
 */
export function geofenceIdentifier(familyCircleId: string, personId: string): string {
  return `beenby:${familyCircleId}:${personId}`;
}

/** Parses an identifier produced by geofenceIdentifier(). */
export function parseGeofenceIdentifier(
  identifier: string,
): { familyCircleId: string; personId: string } | null {
  const parts = identifier.split(":");
  if (parts.length !== 3 || parts[0] !== "beenby") return null;
  const [, familyCircleId, personId] = parts;
  if (!familyCircleId || !personId) return null;
  return { familyCircleId, personId };
}

const noopHandle: PluginListenerHandle = { remove: async () => {} };

export async function getGeofencePermissionStatus(): Promise<PermissionResult> {
  if (!isNativeGeofenceAvailable()) {
    return { status: "denied", monitoringAvailable: false };
  }
  try {
    return await BeenbyGeofence.getPermissionStatus();
  } catch {
    return { status: "denied", monitoringAvailable: false };
  }
}

/**
 * Asks for location permission. iOS requires When In Use before Always, so the
 * flow is: request When In Use → if granted and `always` is wanted, escalate.
 */
export async function requestGeofencePermissions(
  options: { always?: boolean } = {},
): Promise<PermissionResult> {
  if (!isNativeGeofenceAvailable()) {
    return { status: "denied", monitoringAvailable: false };
  }
  try {
    let result = await BeenbyGeofence.requestWhenInUsePermission();
    if (options.always && (result.status === "whenInUse" || result.status === "notDetermined")) {
      result = await BeenbyGeofence.requestAlwaysPermission();
    }
    return result;
  } catch {
    return { status: "denied", monitoringAvailable: false };
  }
}

export async function startGeofence(options: StartRegionOptions): Promise<StartRegionResult> {
  if (!isNativeGeofenceAvailable()) {
    return { started: false, identifier: options.identifier, message: "not-native" };
  }
  try {
    return await BeenbyGeofence.startMonitoringRegion({
      radius: DEFAULT_GEOFENCE_RADIUS,
      ...options,
    });
  } catch (error) {
    return {
      started: false,
      identifier: options.identifier,
      message: error instanceof Error ? error.message : "geofence-error",
    };
  }
}

export async function stopGeofence(identifier: string): Promise<boolean> {
  if (!isNativeGeofenceAvailable()) return false;
  try {
    const result = await BeenbyGeofence.stopMonitoringRegion({ identifier });
    return result.stopped;
  } catch {
    return false;
  }
}

export async function getMonitoredGeofences(): Promise<MonitoredRegion[]> {
  if (!isNativeGeofenceAvailable()) return [];
  try {
    const result = await BeenbyGeofence.getMonitoredRegions();
    return result.regions ?? [];
  } catch {
    return [];
  }
}

export async function addGeofenceEnterListener(
  listener: (event: GeofenceEnterEvent) => void,
): Promise<PluginListenerHandle> {
  if (!isNativeGeofenceAvailable()) return noopHandle;
  try {
    return await BeenbyGeofence.addListener("geofenceEnter", listener);
  } catch {
    return noopHandle;
  }
}

export async function addGeofenceErrorListener(
  listener: (event: GeofenceErrorEvent) => void,
): Promise<PluginListenerHandle> {
  if (!isNativeGeofenceAvailable()) return noopHandle;
  try {
    return await BeenbyGeofence.addListener("geofenceError", listener);
  } catch {
    return noopHandle;
  }
}
