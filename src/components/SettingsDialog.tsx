import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  Palette,
  RotateCcw,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AddressEditor, type EditablePerson } from "@/components/AddressEditor";
import { ColorPicker } from "@/components/ColorPicker";
import { GeofenceSetting } from "@/components/GeofenceSetting";
import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import { Switch } from "@/components/ui/switch";
import { isPushEnabled, setPushEnabled, unregisterPushNotifications } from "@/lib/push";
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
import { deleteMyAccount, leaveFamily } from "@/lib/accountApi";
import { stopAllBeenbyGeofences, type GeofenceBlockReason } from "@/lib/geofenceSync";
import { useT, usePersonLabel } from "@/lib/i18n";
import { PRIVACY_POLICY_URL, TERMS_URL, openExternal } from "@/lib/legal";
import { clearDraft } from "@/lib/onboardingDraft";
import { clearRecovery } from "@/lib/recovery";
import {
  manageSubscription,
  getPremiumState,
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
  circleId,
  myName,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person?: EditablePerson | null;
  userId?: string;
  circleId?: string;
  myName?: string;
  members?: { user_id: string; personal_color: string }[];
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
  const pl = usePersonLabel();
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
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    setPushOn(isPushEnabled());
  }, []);
  const [name, setName] = useState(myName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const myColor = members?.find((m) => m.user_id === userId)?.personal_color ?? null;

  async function handleColorChange(next: string) {
    if (!userId || next === myColor) return;
    const { error } = await supabase
      .from("family_members")
      .update({ personal_color: next })
      .eq("user_id", userId);
    if (error) {
      toast.error(t("settings.colorFailed"));
      return;
    }
    toast.success(t("settings.colorSaved"));
    onPersonUpdated?.();
  }

  /**
   * Clears everything this device keeps locally and returns to the welcome
   * screen. Shared by "start over", "leave family" and "delete account".
   */
  async function wipeLocalAndRestart() {
    clearDraft();
    clearRecovery();
    await stopAllBeenbyGeofences();
    await unregisterPushNotifications();
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
    window.location.replace(`${window.location.origin}/`);
  }

  /**
   * Leaves the family circle on the SERVER. Access to the family's visits,
   * chat and photos disappears immediately — the row level security rules stop
   * matching the moment the membership is gone.
   */
  async function handleLeave() {
    if (leaving || !circleId) return;
    setLeaving(true);
    setLeaveOpen(false);
    try {
      const result = await leaveFamily(circleId);
      if (!result.ok) {
        toast.error(t("leave.failed"));
        return;
      }
      await wipeLocalAndRestart();
    } catch {
      toast.error(t("leave.failed"));
    } finally {
      setLeaving(false);
    }
  }

  /**
   * Deletes the account for real: profile, memberships, own messages and their
   * photos, own visits and plans, devices, purchase record and the login
   * itself. Required by App Store guideline 5.1.1(v).
   */
  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteOpen(false);
    try {
      const result = await deleteMyAccount();
      if (!result.ok) {
        toast.error(t("delete.failed"));
        return;
      }
      await wipeLocalAndRestart();
    } catch {
      toast.error(t("delete.failed"));
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Start over on this device: clears the local onboarding draft, the saved
   * recovery details and the anonymous session, then returns to the welcome
   * page. Nothing is deleted on the server — the family circle lives on and
   * can be rejoined with the family code.
   */
  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    setResetOpen(false);
    try {
      clearDraft();
      clearRecovery();
      // iOS keeps monitoring regions after the app closes — drop them all, or the
      // old address would keep sending arrival notifications after a reset.
      await stopAllBeenbyGeofences();
      // Stop push to this device so the old phone does not keep getting family
      // notifications after the app is reset.
      await unregisterPushNotifications();
      window.localStorage.removeItem("beenby.familyTipSeen");
    } catch {
      // Continue the reset even if a native cleanup step is unavailable.
    }
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    // Hard navigation rebuilds the whole app state from scratch. We always go
    // to the app root: inside the packaged iOS app only index.html exists on
    // disk, so replacing straight to a deep path such as /start/valkommen
    // loads nothing and leaves a white screen. From "/" the start page routes
    // on to the welcome screen because there is no circle any more.
    const root = `${window.location.origin}/`;
    window.location.replace(root);
    setResetting(false);
  }



  useEffect(() => {
    if (open) setName(myName ?? "");
  }, [open, myName]);

  async function handleSaveName() {
    if (!userId) return;
    const next = name.trim();
    if (next.length < 1 || savingName) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from("profiles").update({ name: next }).eq("id", userId);
      if (error) {
        toast.error(t("settings.nameFailed"));
        return;
      }
      toast.success(t("settings.nameSaved"));
      onPersonUpdated?.();
    } finally {
      setSavingName(false);
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
    try {
      const result = await purchasePremium();
      const snapshot = getPremiumState();
      if (result.outcome === "success") {
        if (!snapshot.isPremium && snapshot.verifyError) {
          toast.error(t("settings.verifyFailed"), { description: t("settings.verifyFailedDesc") });
        } else {
          toast.success(t("settings.restored"));
        }
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
      } else {
        toast.message(t("settings.noPurchase"), { description: t("settings.noPurchaseDesc") });
      }
    } finally {
      setRestoring(false);
    }
  }

  async function handleManage() {
    const opened = await manageSubscription();
    if (!opened) {
      toast.message(t("settings.manage"), { description: t("settings.manageDesc") });
    }
  }

  return (
    <>
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

        {userId && members && members.length > 0 ? (
          <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Palette className="size-4" /> {t("settings.colorTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("settings.colorHint")}</p>
            <ColorPicker
              value={myColor}
              taken={members.filter((m) => m.user_id !== userId).map((m) => m.personal_color)}
              onChange={(next) => void handleColorChange(next)}
            />
          </section>
        ) : null}

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

        <section className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="size-4" /> {t("settings.pushTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("settings.pushHint")}</p>
            <p className="text-xs text-muted-foreground">
              {pushOn ? t("settings.pushOn") : t("settings.pushOff")}
            </p>
          </div>
          <Switch
            checked={pushOn}
            aria-label={t("settings.pushTitle")}
            onCheckedChange={(next) => {
              setPushOn(next);
              void setPushEnabled(next);
            }}
          />
        </section>

        {geofence ? (
          <GeofenceSetting
            personName={pl(person?.name)}
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

        {circleId ? (
          <section className="space-y-2 rounded-2xl bg-secondary/60 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <LogOut className="size-4" /> {t("leave.title")}
            </p>
            <p className="text-xs text-muted-foreground">{t("leave.desc")}</p>
            <Button
              variant="secondary"
              className="h-10 w-full rounded-2xl text-xs"
              disabled={leaving}
              onClick={() => setLeaveOpen(true)}
            >
              {leaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("leave.button")}
            </Button>
          </section>
        ) : null}

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

        <section className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Trash2 className="size-4" /> {t("delete.title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("delete.desc")}</p>
          <Button
            variant="secondary"
            className="h-10 w-full rounded-2xl text-xs text-destructive"
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("delete.button")}
          </Button>
        </section>


      </DialogContent>
    </Dialog>
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("leave.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("leave.confirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">{t("reset.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleLeave()}
            >
              {t("leave.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete.confirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">{t("reset.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteAccount()}
            >
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
}