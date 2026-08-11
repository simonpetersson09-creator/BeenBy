/**
 * Owns the "Påminn mig när jag kommer fram" state for one user + circle.
 *
 * The hook never asks for permissions on its own — only `toggle(true)` does,
 * i.e. only when the user actively turns the setting on.
 *
 * syncGeofenceState() runs on: mount (app start), foreground/resume,
 * address change, access change and every toggle.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getGeofencePreference,
  ensureGeofencePermissions,
  setGeofencePreference,
  syncGeofenceState,
  type GeofenceBlockReason,
  type GeofencePerson,
} from "@/lib/geofenceSync";
import { isNativeGeofenceAvailable } from "@/lib/geofence";

export type GeofenceToggleOutcome =
  | { ok: true }
  | { ok: false; reason: GeofenceBlockReason };

export function useGeofenceSync(options: {
  circleId: string;
  userId: string;
  person: GeofencePerson | null;
  hasAccess: boolean;
}) {
  const { circleId, userId, person, hasAccess } = options;
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [reason, setReason] = useState<GeofenceBlockReason | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const enabledRef = useRef(false);

  const lat = person?.location_latitude ?? null;
  const lng = person?.location_longitude ?? null;
  const personId = person?.id ?? null;

  const sync = useCallback(
    async (pref?: boolean) => {
      const result = await syncGeofenceState({
        circleId,
        userId,
        person,
        hasAccess,
        ...(pref === undefined ? {} : { enabled: pref }),
      });
      setActive(result.active);
      setReason(result.reason);
      return result;
    },
    // person is re-created on every refresh; the identity that matters is these
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [circleId, userId, personId, lat, lng, hasAccess],
  );

  // Load the stored preference, then reconcile the native state.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pref = await getGeofencePreference(circleId, userId);
      if (cancelled) return;
      enabledRef.current = pref;
      setEnabled(pref);
      await sync(pref);
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId, userId, sync]);

  // Foreground / resume.
  useEffect(() => {
    const run = () => void sync(enabledRef.current);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    let removeNative: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) run();
        }),
      )
      .then((handle) => {
        if (cancelled) {
          void handle.remove();
          return;
        }
        removeNative = () => void handle.remove();
      })
      .catch(() => {
        /* web — visibilitychange is enough */
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      removeNative?.();
    };
  }, [sync]);

  const toggle = useCallback(
    async (next: boolean): Promise<GeofenceToggleOutcome> => {
      if (busy) return { ok: false, reason: "not-native" };
      setBusy(true);
      try {
        if (!next) {
          enabledRef.current = false;
          setEnabled(false);
          await setGeofencePreference(circleId, userId, false);
          await sync(false);
          return { ok: true };
        }

        if (!hasAccess) return { ok: false, reason: "no-access" };
        if (!person || person.location_latitude == null || person.location_longitude == null) {
          return { ok: false, reason: "no-address" };
        }
        if (!isNativeGeofenceAvailable()) {
          // Web preview: remember the preference, never start a real geofence.
          enabledRef.current = true;
          setEnabled(true);
          await setGeofencePreference(circleId, userId, true);
          return { ok: false, reason: "not-native" };
        }

        const permissions = await ensureGeofencePermissions();
        if (!permissions.ok) {
          setReason(permissions.reason);
          return { ok: false, reason: permissions.reason };
        }

        enabledRef.current = true;
        setEnabled(true);
        await setGeofencePreference(circleId, userId, true);
        const result = await sync(true);
        if (!result.active) return { ok: false, reason: result.reason ?? "location-missing" };
        return { ok: true };
      } finally {
        setBusy(false);
      }
    },
    [busy, circleId, userId, hasAccess, person, sync],
  );

  return { enabled, active, reason, busy, toggle, sync };
}
