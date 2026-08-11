/**
 * Runs `processPendingGeofenceConfirmations()` at the three moments where a
 * "Ja" answer can become visible to the app:
 *
 *   1. app start (mount)
 *   2. app becomes active again (visibilitychange + native appStateChange)
 *   3. the native `geofenceConfirmed` event while the app is already open
 *
 * All three go through the exact same handler — there is no fast path — and
 * the handler itself de-duplicates overlapping runs.
 */
import { useEffect } from "react";
import { toast } from "sonner";

import { addGeofenceConfirmedListener } from "@/lib/geofence";
import { processPendingGeofenceConfirmations } from "@/lib/geofenceVisits";

/** `successMessage` comes from the caller's `useT()` so i18n stays in one place. */
export function useGeofenceVisits(onRecorded: () => void, successMessage: string) {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await processPendingGeofenceConfirmations();
      if (cancelled || result.recorded === 0) return;
      onRecorded();
      toast.success(successMessage);
    };

    void run();

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    let removeConfirmed: (() => void) | undefined;
    void addGeofenceConfirmedListener(() => void run()).then((handle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      removeConfirmed = () => void handle.remove();
    });

    let removeNative: (() => void) | undefined;
    void import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void run();
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
        /* web / plugin unavailable — visibilitychange is enough */
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      removeConfirmed?.();
      removeNative?.();
    };
  }, [onRecorded, successMessage]);
}
