import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
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
import { isAnonymous } from "@/lib/auth";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [anon, setAnon] = useState(true);
  const [linking, setLinking] = useState(false);
  const [premium, setPremium] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      setAnon(isAnonymous(data.user));
      if (!data.user) return;
      const { data: ent } = await supabase
        .from("premium_entitlements")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setPremium(ent?.is_active === true);
    });
  }, [open]);

  async function link(provider: "apple" | "google") {
    setLinking(true);
    // linkIdentity upgrades the CURRENT user – no new account, nothing is lost.
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.origin },
    });
    setLinking(false);
    if (error) {
      toast.error("Det gick inte att koppla kontot just nu. Försök igen.");
    }
  }

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
          <DialogDescription>Ditt konto och din prenumeration.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" /> Skydda ditt konto
          </p>
          {anon ? (
            <>
              <p className="text-sm text-muted-foreground">
                Just nu finns din familj bara på den här telefonen. Koppla ett konto så kan du hämta
                tillbaka familjen, dina besök och din färg om du byter telefon.
              </p>
              <div className="space-y-2">
                <Button
                  className="h-12 w-full rounded-2xl"
                  disabled={linking}
                  onClick={() => link("apple")}
                >
                  {linking ? <Loader2 className="size-4 animate-spin" /> : null}
                  Koppla Sign in with Apple
                </Button>
                <Button
                  variant="secondary"
                  className="h-12 w-full rounded-2xl"
                  disabled={linking}
                  onClick={() => link("google")}
                >
                  Koppla Google
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Inget nytt konto skapas – din nuvarande identitet uppgraderas, så allt du redan gjort
                finns kvar.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ditt konto är skyddat. Du kan logga in igen på en ny telefon och få tillbaka allt.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" /> Premium
          </p>
          <p className="text-sm text-muted-foreground">
            {premium
              ? "Premium är aktivt för dig."
              : "Premium är personligt och kommer som en prenumeration i App Store."}
          </p>
          <Button
            variant="ghost"
            className="h-12 w-full rounded-2xl"
            disabled={restoring}
            onClick={restorePurchases}
          >
            {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
            Återställ köp
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
