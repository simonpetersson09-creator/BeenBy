import { Bell, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { GeofenceBlockReason } from "@/lib/geofenceSync";
import { openNativeSettings } from "@/lib/geofenceSync";
import { useT } from "@/lib/i18n";

/**
 * "Påminn mig när jag kommer fram" — the only UI for geofencing.
 * All state lives in useGeofenceSync(); this component just renders it.
 */
export function GeofenceSetting({
  personName,
  hasAccess,
  enabled,
  reason,
  busy,
  onToggle,
  onLocked,
  onNeedsAddress,
}: {
  personName: string;
  hasAccess: boolean;
  enabled: boolean;
  reason?: GeofenceBlockReason;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onLocked: () => void;
  onNeedsAddress: () => void;
}) {
  const t = useT();

  const problem =
    !enabled || !reason
      ? null
      : reason === "no-address"
        ? t("geofence.needsAddress")
        : reason === "location-denied"
          ? t("geofence.locationDenied")
          : reason === "location-missing"
            ? t("geofence.locationAlways")
            : reason === "notifications-denied"
              ? t("geofence.notificationsDenied")
              : reason === "not-native"
                ? t("geofence.iosOnly")
                : null;

  const canOpenSettings =
    reason === "location-denied" ||
    reason === "location-missing" ||
    reason === "notifications-denied";

  return (
    <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {hasAccess ? <Bell className="size-4" /> : <Lock className="size-4" />}{" "}
            {t("geofence.title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("geofence.hint", { name: personName })}
          </p>
        </div>
        {busy ? (
          <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : hasAccess ? (
          <Switch
            checked={enabled}
            aria-label={t("geofence.title")}
            onCheckedChange={(next) => {
              if (next && reason === "no-address") {
                toast.message(t("geofence.needsAddress"));
                onNeedsAddress();
                return;
              }
              onToggle(next);
            }}
          />
        ) : (
          <button
            type="button"
            aria-label={t("geofence.locked")}
            onClick={onLocked}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <Lock className="size-4" />
          </button>
        )}
      </div>

      {!hasAccess ? (
        <p className="text-xs text-muted-foreground">{t("geofence.locked")}</p>
      ) : problem ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{problem}</p>
          {canOpenSettings ? (
            <Button
              variant="secondary"
              className="h-10 w-full rounded-2xl text-xs"
              onClick={() => void openNativeSettings()}
            >
              {t("geofence.openSettings")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {enabled ? t("geofence.on") : t("geofence.off")}
        </p>
      )}
    </section>
  );
}
