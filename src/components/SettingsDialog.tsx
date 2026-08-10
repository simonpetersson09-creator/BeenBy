import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import {
  getSubscriptionStatus,
  openSubscriptionManagement,
  purchasePremium,
  restorePurchases,
} from "@/lib/premium";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoadingPremium, setIsLoadingPremium] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsLoadingPremium(true);
    const status = await getSubscriptionStatus();
    setIsPremium(status.isPremium);
    setIsLoadingPremium(false);
    return status;
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open, refreshStatus]);

  async function handlePurchase() {
    if (purchasing) return; // prevent double-tap
    setPurchasing(true);
    const result = await purchasePremium();
    if (result.outcome === "success") {
      await refreshStatus();
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
    const status = await refreshStatus();
    if (result.restored || status.isPremium) toast.success(t("settings.restored"));
    else toast.message(t("settings.noPurchase"), { description: t("settings.noPurchaseDesc") });
    setRestoring(false);
  }

  async function handleManage() {
    const opened = await openSubscriptionManagement();
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

        <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" /> {t("settings.premium")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPremium
              ? t("settings.premiumActive")
              : t("settings.premiumInactive")}
          </p>

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
