import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const [premium, setPremium] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: ent } = await supabase
        .from("premium_entitlements")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setPremium(ent?.is_active === true);
    });
  }, [open]);

  async function restorePurchases() {
    setRestoring(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: ent } = await supabase
        .from("premium_entitlements")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setPremium(ent?.is_active === true);
      if (ent?.is_active) toast.success(t("settings.restored"));
      else toast.message(t("settings.noPurchase"), { description: t("settings.noPurchaseDesc") });
    }
    setRestoring(false);
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
            {premium
              ? t("settings.premiumActive")
              : t("settings.premiumInactive")}
          </p>

          <Button
            className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              toast.message(t("settings.soon"), {
                description: t("settings.soonDesc"),
              })
            }
          >
            {t("settings.start")}
          </Button>

          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              disabled={restoring}
              onClick={restorePurchases}
            >
              {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("settings.restore")}
            </Button>
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                toast.message(t("settings.manage"), {
                  description: t("settings.manageDesc"),
                })
              }
            >
              {t("settings.manage")}
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
