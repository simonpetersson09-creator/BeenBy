import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { getPremiumState, purchasePremium, restorePurchases, usePremium } from "@/lib/premiumStore";

/**
 * Shown when a user without access (trial over, no Premium) taps a locked
 * feature. Uses the existing StoreKit flow — no separate payment system.
 */
export function Paywall({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const { priceLabel } = usePremium();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handlePurchase() {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await purchasePremium();
      const snapshot = getPremiumState();
      if (result.outcome === "success" && !snapshot.isPremium && snapshot.verifyError) {
        toast.error(t("settings.verifyFailed"), { description: t("settings.verifyFailedDesc") });
      } else if (result.outcome === "success") {
        toast.success(t("settings.restored"));
        onOpenChange(false);
      } else if (result.outcome === "cancelled") {
        toast.message(t("settings.noPurchase"));
      } else {
        toast.message(t("settings.soon"), { description: t("settings.soonDesc") });
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      const snapshot = getPremiumState();
      if (result.restored && !snapshot.isPremium && snapshot.verifyError) {
        toast.error(t("settings.verifyFailed"), { description: t("settings.verifyFailedDesc") });
      } else if (result.restored) {
        toast.success(t("settings.restored"));
        onOpenChange(false);
      } else {
        toast.message(t("settings.noPurchase"), { description: t("settings.noPurchaseDesc") });
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <Sparkles className="size-5" /> {t("paywall.title")}
          </DialogTitle>
          <DialogDescription>{t("paywall.body")}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("paywall.desc")}</p>

        {priceLabel ? (
          <p className="text-sm font-medium text-primary">
            {t("paywall.price", { price: priceLabel })}
          </p>
        ) : null}

        <Button
          className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground hover:bg-primary/90"
          disabled={purchasing}
          onClick={handlePurchase}
        >
          {purchasing ? <Loader2 className="size-4 animate-spin" /> : null}
          {priceLabel
            ? `${t("settings.start")} · ${t("paywall.price", { price: priceLabel })}`
            : t("settings.start")}
        </Button>


        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-11 flex-1 rounded-2xl text-sm"
            disabled={restoring}
            onClick={handleRestore}
          >
            {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("settings.restore")}
          </Button>
          <Button
            variant="ghost"
            className="h-11 flex-1 rounded-2xl text-sm"
            onClick={() => onOpenChange(false)}
          >
            {t("paywall.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
