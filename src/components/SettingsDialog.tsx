import { useEffect, useState } from "react";
import { Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AddressEditor, type EditablePerson } from "@/components/AddressEditor";
import { GeofenceSetting } from "@/components/GeofenceSetting";
import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GeofenceBlockReason } from "@/lib/geofenceSync";
import { useT } from "@/lib/i18n";
import {
  manageSubscription,
  purchasePremium,
  refreshPremiumStatus,
  refreshTrialStatus,
  restorePurchases,
  usePremium,
} from "@/lib/premiumStore";

export function SettingsDialog({
  open,
  onOpenChange,
  person,
  onPersonUpdated,
  geofence,
  onOpenPaywall,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person?: EditablePerson | null;
  onPersonUpdated?: () => void;
  geofence?: {
    enabled: boolean;
    reason?: GeofenceBlockReason;
    busy: boolean;
    toggle: (next: boolean) => void;
  };
  onOpenPaywall?: () => void;
}) {
  const t = useT();
  const {
    isPremium,
    loading: isLoadingPremium,
    isTrialActive,
    trialDaysLeft,
    hasAccess,
  } = usePremium();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    void refreshPremiumStatus();
    void refreshTrialStatus();
  }, [open]);

  async function handlePurchase() {
    if (purchasing) return; // prevent double-tap
    setPurchasing(true);
    const result = await purchasePremium();
    if (result.outcome === "success") {
      toast.success(t("settings.restored"));
    } else if (result.outcome === "cancelled") {
      toast.message(t("settings.noPurchase"));
    } else {
      // pending / error / not available outside the native iOS app
      toast.message(t("settings.soon"), { description: t("settings.soonDesc") });
    }
    setPurchasing(false);
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    if (result.restored) toast.success(t("settings.restored"));
    else toast.message(t("settings.noPurchase"), { description: t("settings.noPurchaseDesc") });
    setRestoring(false);
  }

  async function handleManage() {
    const opened = await manageSubscription();
    if (!opened) {
      toast.message(t("settings.manage"), { description: t("settings.manageDesc") });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.sub")}</DialogDescription>
        </DialogHeader>

        <section className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-4">
          <div>
            <p className="font-medium">{t("settings.langTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.langHint")}</p>
          </div>
          <LanguageSwitcher />
        </section>

        {person ? (
          <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
            <p className="flex items-center gap-2 font-medium">
              <MapPin className="size-4" /> {t("address.section")}
            </p>
            <p className="text-xs text-muted-foreground">
              {person.address ? person.address : t("address.missing")}
            </p>
            <Button
              variant="secondary"
              className="h-11 w-full rounded-2xl text-sm"
              onClick={() => setAddressOpen(true)}
            >
              {person.address ? t("address.change") : t("address.add")}
            </Button>
          </section>
        ) : null}

        {person && geofence ? (
          <GeofenceSetting
            personName={person.name}
            hasAccess={hasAccess}
            enabled={geofence.enabled}
            {...(geofence.reason ? { reason: geofence.reason } : {})}
            busy={geofence.busy}
            onToggle={geofence.toggle}
            onLocked={() => {
              onOpenChange(false);
              onOpenPaywall?.();
            }}
            onNeedsAddress={() => setAddressOpen(true)}
          />
        ) : null}

        {person ? (
          <AddressEditor
            person={person}
            open={addressOpen}
            onOpenChange={setAddressOpen}
            onSaved={onPersonUpdated}
          />
        ) : null}

        <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" /> {t("settings.premium")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPremium
              ? t("settings.premiumActive")
              : isTrialActive
                ? trialDaysLeft === 1
                  ? t("settings.trialLeftOne")
                  : t("settings.trialLeft", { n: String(trialDaysLeft) })
                : t("settings.trialEnded")}
          </p>
          {isPremium ? null : (
            <p className="text-xs text-muted-foreground">{t("settings.premiumInactive")}</p>
          )}

          <Button
            className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground hover:bg-primary/90"
            disabled={purchasing || isLoadingPremium}
            onClick={handlePurchase}
          >
            {purchasing ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("settings.start")}
          </Button>

          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              disabled={restoring}
              onClick={handleRestore}
            >
              {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("settings.restore")}
            </Button>
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              onClick={handleManage}
            >
              {t("settings.manage")}
            </Button>
          </div>
        </section>

      </DialogContent>
    </Dialog>
  );
}
