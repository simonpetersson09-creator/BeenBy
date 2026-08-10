import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
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
      if (ent?.is_active) toast.success("Premium återställt.");
      else toast.message("Inget köp hittades", { description: "Premium är inte aktivt än." });
    }
    setRestoring(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Inställningar</DialogTitle>
          <DialogDescription>Din prenumeration.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" /> Premium
          </p>
          <p className="text-xs text-muted-foreground">
            {premium
              ? "Premium är aktivt för dig."
              : "Premium är personligt och kommer som en prenumeration i App Store."}
          </p>

          <Button
            className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              toast.message("Premium kommer snart", {
                description: "Köp aktiveras när prenumerationen är live i App Store.",
              })
            }
          >
            Starta premium
          </Button>

          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              disabled={restoring}
              onClick={restorePurchases}
            >
              {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
              Återställ köp
            </Button>
            <Button
              className="h-11 flex-1 rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                toast.message("Hantera abonnemang", {
                  description: "Detta öppnar App Store-prenumerationen i appen.",
                })
              }
            >
              Hantera abonnemang
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
