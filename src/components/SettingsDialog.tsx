import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2, MapPin, RotateCcw, Sparkles, User, Users } from "lucide-react";
import { toast } from "sonner";

import { AddressEditor, type EditablePerson } from "@/components/AddressEditor";
import { GeofenceSetting } from "@/components/GeofenceSetting";
import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { GeofenceBlockReason } from "@/lib/geofenceSync";
import { useT } from "@/lib/i18n";
import { PRIVACY_POLICY_URL, TERMS_URL, openExternal } from "@/lib/legal";
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
  userId,
  myName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person?: EditablePerson | null;
  userId?: string;
  myName?: string;
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
  const navigate = useNavigate();
  const {
    isPremium,
    loading: isLoadingPremium,
    isTrialActive,
    trialDaysLeft,
    hasAccess,
    priceLabel,
  } = usePremium();

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [name, setName] = useState(myName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  /**
   * Start over on this device: clears the local onboarding draft, the saved
   * recovery details and the anonymous session, then returns to the welcome
   * page. Nothing is deleted on the server — the family circle lives on and
   * can be rejoined with the family code.
   */
  async function handleReset() {
    setResetOpen(false);
    onOpenChange(false);
    clearDraft();
    clearRecovery();
    try {
      window.localStorage.removeItem("beenby.familyTipSeen");
    } catch {
      /* storage unavailable */
    }
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    await navigate({ to: "/start/valkommen", replace: true });
    if (typeof window !== "undefined") window.location.reload();
  }



  useEffect(() => {
    if (open) setName(myName ?? "");
  }, [open, myName]);

  async function handleSaveName() {
    if (!userId) return;
    const next = name.trim();
    if (next.length < 1 || savingName) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ name: next }).eq("id", userId);
    setSavingName(false);
    if (error) {
      toast.error(t("settings.nameFailed"));
      return;
    }
    toast.success(t("settings.nameSaved"));
    onPersonUpdated?.();
  }

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
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[88dvh] gap-2.5 overflow-y-auto rounded-3xl p-5 sm:max-w-md"
      >
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-lg">{t("settings.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("settings.sub")}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
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

          {isPremium ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground">
              <Sparkles className="size-4" />
              {t("settings.premiumActiveBtn")}
            </div>
          ) : (
            <Button
              className="h-11 w-full rounded-2xl bg-primary text-sm text-primary-foreground hover:bg-primary/90"
              disabled={purchasing || isLoadingPremium}
              onClick={handlePurchase}
            >
              {purchasing ? <Loader2 className="size-4 animate-spin" /> : null}
              {priceLabel
                ? `${t("settings.start")} · ${t("paywall.price", { price: priceLabel })}`
                : t("settings.start")}
            </Button>
          )}



          <div className="flex gap-2">
            <Button
              className="h-10 flex-1 rounded-2xl bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              disabled={restoring}
              onClick={handleRestore}
            >
              {restoring ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("settings.restore")}
            </Button>
            <Button
              className="h-10 flex-1 rounded-2xl bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              onClick={handleManage}
            >
              {t("settings.manage")}
            </Button>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-primary/15 bg-secondary/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Users className="size-4" /> {t("settings.joinTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("settings.joinHint")}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full justify-center gap-2 rounded-2xl border-primary/30 text-sm font-medium"
            onClick={() => {
              onOpenChange(false);
              void navigate({ to: "/start/kod", search: { from: "app" } });
            }}
          >
            <KeyRound className="size-4" />
            {t("settings.joinCta")}
          </Button>
        </section>



        <section className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-3">
          <div>
            <p className="text-sm font-medium">{t("settings.langTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.langHint")}</p>
          </div>
          <LanguageSwitcher />
        </section>

        {userId ? (
          <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <User className="size-4" /> {t("settings.nameTitle")}
            </p>
            <div className="flex gap-2">
              <Input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="h-10 flex-1 rounded-2xl text-base"
              />
              <Button
                variant="secondary"
                className="h-10 rounded-2xl px-3 text-xs"
                disabled={savingName || name.trim().length < 1 || name.trim() === (myName ?? "")}
                onClick={handleSaveName}
              >
                {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("settings.nameSave")}
              </Button>
            </div>
          </section>
        ) : null}

        {person ? (
          <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4" /> {t("address.section")}
            </p>
            <p className="text-xs text-muted-foreground">
              {person.address ? person.address : t("address.missing")}
            </p>
            <Button
              variant="secondary"
              className="h-10 w-full rounded-2xl text-xs"
              onClick={() => setAddressOpen(true)}
            >
              {person.address ? t("address.change") : t("address.add")}
            </Button>
          </section>
        ) : null}

        {geofence ? (
          <GeofenceSetting
            personName={person?.name ?? ""}
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

        <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-10 rounded-2xl text-xs"
              onClick={() => {
                if (!openExternal(PRIVACY_POLICY_URL)) toast.message(t("legal.privacy"));
              }}
            >
              {t("legal.privacy")}
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-2xl text-xs"
              onClick={() => {
                if (!openExternal(TERMS_URL)) toast.message(t("legal.terms"));
              }}
            >
              {t("legal.terms")}
            </Button>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <RotateCcw className="size-4" /> {t("reset.title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("reset.desc")}</p>
          <Button
            variant="secondary"
            className="h-10 w-full rounded-2xl text-xs text-destructive"
            onClick={() => setResetOpen(true)}
          >
            {t("reset.button")}
          </Button>
        </section>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("reset.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("reset.confirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl">{t("reset.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleReset()}
              >
                {t("reset.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}
