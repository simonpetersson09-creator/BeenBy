import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, CloudOff, Loader2, Lock, MapPinCheckInside, MessageCircle, Plus, RefreshCw, Settings, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { DayDetail } from "@/components/DayDetail";
import { DotGrid, buildDays } from "@/components/DotGrid";
import { InviteSheet } from "@/components/InviteSheet";
import { Paywall } from "@/components/Paywall";
import { SettingsDialog } from "@/components/SettingsDialog";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CircleData, PlannedVisit } from "@/hooks/useCircleData";
import { useFamilyNotifications } from "@/hooks/useFamilyNotifications";
import { useGeofenceVisits } from "@/hooks/useGeofenceVisits";
import { useGeofenceSync } from "@/hooks/useGeofenceSync";
import { useOnlineStatus } from "@/hooks/useSession";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { supabase } from "@/integrations/supabase/client";
import { ActivityPicker } from "@/components/ActivityPicker";
import { activitySummary, type ActivityId } from "@/lib/activities";
import { addDays, parseKey, relativeLabel, todayKey } from "@/lib/dates";
import { useT, usePersonLabel } from "@/lib/i18n";
import { getPending, type PendingVisit } from "@/lib/offline";
import { colorById } from "@/lib/palette";
import { registerPushNotifications } from "@/lib/push";

import { refreshTrialStatus, useAccess } from "@/lib/premiumStore";
import { saveRecovery } from "@/lib/recovery";
import { deleteVisit, flushPendingVisits, recordVisit, type VisitSource } from "@/lib/visits";

export function HomeScreen({
  data,
  userId,
  refresh,
}: {
  data: CircleData;
  userId: string;
  refresh: () => void;
}) {
  const t = useT();
  const pl = usePersonLabel();
  const { circle, person, members, visits, planned } = data;
  const tz = circle.timezone;
  const online = useOnlineStatus();

  // Toast the siblings when someone writes in the chat or joins the family.
  useFamilyNotifications({ circleId: circle.id, userId, onEvent: refresh });
  // Real push notifications (iOS) so notices arrive even when the app is closed.
  useEffect(() => {
    void registerPushNotifications();
  }, [userId]);
  // "Ja" on a geofence arrival notification → existing recordVisit() path.
  useGeofenceVisits(refresh, t("toast.geofenceVisitSaved"));


  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmSecond, setConfirmSecond] = useState(false);
  const [confirmVisit, setConfirmVisit] = useState(false);
  // Optional activities for the visit being registered / planned.
  const [acts, setActs] = useState<ActivityId[]>([]);
  const [actNote, setActNote] = useState("");
  const resetActs = () => {
    setActs([]);
    setActNote("");
  };
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [planCalendarOpen, setPlanCalendarOpen] = useState(false);
  const unread = useUnreadMessages(circle.id, userId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { hasAccess, isPremium, isTrialActive, trialDaysLeft } = useAccess();
  const locked = !hasAccess;

  // A native resume can happen immediately after the user taps a control.
  // Never close visible UI here: the delayed resume event would otherwise open
  // Settings and then close it again, making the button appear to need two taps.
  // The global viewport guard repairs stale overlays and interaction locks.
  useEffect(() => {
    const clearStaleBusyState = () => setBusy(false);
    window.addEventListener("beenby:resume", clearStaleBusyState);
    return () => window.removeEventListener("beenby:resume", clearStaleBusyState);
  }, []);

  // Arrival reminder (geofence): keeps the native region in sync with the
  // saved preference, access and the person's coordinates.
  const geofence = useGeofenceSync({ circleId: circle.id, userId, person, hasAccess });
  const handleGeofenceToggle = useCallback(
    (next: boolean) => {
      void (async () => {
        const result = await geofence.toggle(next);
        if (result.ok) {
          toast.success(next ? t("geofence.on") : t("geofence.off"));
          return;
        }
        if (result.reason === "no-access") {
          setPaywallOpen(true);
          return;
        }
        if (result.reason === "no-address") toast.message(t("geofence.needsAddress"));
        else if (result.reason === "location-denied") toast.message(t("geofence.locationDenied"));
        else if (result.reason === "location-missing") toast.message(t("geofence.locationAlways"));
        else if (result.reason === "notifications-denied")
          toast.message(t("geofence.notificationsDenied"));
        else toast.message(t("geofence.iosOnly"));
      })();
    },
    [geofence, t],
  );

  // Ask once, in-app, whether the arrival reminder should be turned on.
  const [askGeofence, setAskGeofence] = useState(false);
  const askKey = `beenby.geofenceAsked.${circle.id}`;
  const hasCoords = person?.location_latitude != null && person?.location_longitude != null;
  useEffect(() => {
    if (!hasAccess || !hasCoords || geofence.enabled || geofence.busy) return;
    if (window.localStorage.getItem(askKey)) return;
    const timer = window.setTimeout(() => setAskGeofence(true), 900);
    return () => window.clearTimeout(timer);
  }, [hasAccess, hasCoords, geofence.enabled, geofence.busy, askKey]);

  function closeGeofenceAsk() {
    window.localStorage.setItem(askKey, "1");
    setAskGeofence(false);
  }





  // The family tooltip is shown once, briefly, the first time.
  useEffect(() => {
    if (members.length !== 1) return;
    if (window.localStorage.getItem("beenby.familyTipSeen")) return;
    setShowTooltip(true);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("beenby.familyTipSeen", "1");
      setShowTooltip(false);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [members.length]);

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingVisit[]>([]);

  useEffect(() => {
    const sync = () => setPending(getPending());
    sync();
    window.addEventListener("pending-visits-changed", sync);
    return () => window.removeEventListener("pending-visits-changed", sync);
  }, []);

  // The trial start is written server-side when the user joins/creates a
  // circle — re-read it once we know the user is in a circle.
  useEffect(() => {
    void refreshTrialStatus();
  }, [userId]);

  const me = members.find((m) => m.user_id === userId);

  // Keep a local recovery record so the family can be restored if the
  // background identity is ever lost.
  useEffect(() => {
    if (!me) return;
    saveRecovery({
      code: circle.family_code,
      name: me.name,
      color: me.personal_color,
    });
  }, [circle.family_code, me]);
  const days = useMemo(() => buildDays(tz, visits, planned, members), [tz, visits, planned, members]);
  const today = todayKey(tz);
  const myVisitToday = visits.find((v) => v.user_id === userId && v.local_day === today);

  const nextPlanned = useMemo(
    () =>
      planned
        .filter((p) => p.status === "planned" && p.planned_date >= today)
        .sort((a, b) => a.planned_date.localeCompare(b.planned_date))[0],
    [planned, today],
  );

  const flush = useCallback(async () => {
    const flushed = await flushPendingVisits(userId);
    if (flushed > 0) refresh();
  }, [refresh, userId]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  async function saveVisit(source: VisitSource) {
    if (!person) return;
    if (busy) return;
    setBusy(true);
    try {
      const result = await recordVisit({
        familyCircleId: circle.id,
        personId: person.id,
        userId,
        timezone: tz,
        source,
        activities: acts,
        activityNote: acts.includes("other") ? actNote.trim() || null : null,
      });
      resetActs();

      if (result.status === "queued") {
        if (result.reason === "offline") {
          toast.message(t("toast.savedLocal"), {
            description: t("toast.savedLocalDesc"),
          });
        } else {
          toast.message(t("toast.offline"), {
            description: t("toast.offlineDesc") },
          );
        }
        return;
      }

      if (result.status === "duplicate") return;

      const visitId = result.visitId;
      refresh();
      toast.success(t("toast.visitSaved"), {
        duration: 6000,
        action: visitId
          ? {
              label: t("toast.undo"),
              onClick: async () => {
                await deleteVisit(visitId);
                refresh();
              },
            }
          : undefined,
      });
    } finally {
      setBusy(false);
    }
  }


  function handleImHere() {
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    if (myVisitToday) {
      resetActs();
      setConfirmSecond(true);
      return;
    }
    // Always ask once more so a visit is never registered by mistake.
    resetActs();
    setConfirmVisit(true);
  }

  async function planVisit(date: string) {
    if (!person) return;
    setPlanOpen(false);
    const { error } = await supabase.from("planned_visits").insert({
      family_circle_id: circle.id,
      person_id: person.id,
      user_id: userId,
      planned_date: date,
      activities: acts,
      activity_note: acts.includes("other") ? actNote.trim() || null : null,
    });
    if (error) {
      toast.error(t("toast.planError"));
      resetActs();
      setPlanDate(null);
      return;
    }
    resetActs();
    setPlanDate(null);
    refresh();
    toast.success(t("toast.planned", { when: relativeLabel(date, tz).toLowerCase() }));
  }

  async function completePlanned(p: PlannedVisit) {
    await recordVisit({
      familyCircleId: circle.id,
      personId: p.person_id,
      userId,
      timezone: tz,
      source: "confirmed_planned_visit",
      localDay: p.planned_date,
      activities: p.activities ?? [],
      activityNote: p.activity_note ?? null,
    });
    await supabase.from("planned_visits").update({ status: "completed" }).eq("id", p.id);
    setSelectedDay(null);
    refresh();
    toast.success(t("toast.visitSaved"));
  }

  /** Sharing uses the family code only — no link is generated or shared. */
  function invite() {
    setInviteOpen(true);
  }

  const planDates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <div
      className="app-scroll mx-auto h-dvh w-full max-w-md px-5 pb-40"
      style={{ paddingTop: "calc(var(--safe-top, 0px) + 2rem)" }}
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-primary/60">
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-1 truncate text-[2rem] leading-[1.1] text-primary">
            {pl(person?.name) || circle.name}
          </h1>
          <span className="mt-2 block h-px w-10 bg-primary/30" />
        </div>
        <div className="relative flex shrink-0 gap-2">
          <Button
            onClick={() => setFamilyOpen(true)}
            className="h-12 rounded-2xl bg-primary px-3 text-xs font-medium leading-tight text-primary-foreground shadow-soft hover:bg-primary/90"
          >
            <span className="whitespace-pre-line text-center">{t("home.inviteSiblings")}</span>
          </Button>
          <Button
            size="icon"
            aria-label={t("home.settings")}
            onClick={() => setSettingsOpen(true)}
            className="size-12 rounded-2xl bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"
          >
            <Settings className="size-6" />
          </Button>


          {showTooltip ? (
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("beenby.familyTipSeen", "1");
                setShowTooltip(false);
                setFamilyOpen(true);
              }}
              className="absolute right-0 top-full z-20 mt-2 w-56 animate-in fade-in slide-in-from-top-1 rounded-2xl bg-primary px-3 py-2 text-left text-[0.7rem] leading-snug text-primary-foreground shadow-lift"
            >
              <span
                aria-hidden
                className="absolute -top-1.5 right-[7.5rem] size-3 rotate-45 rounded-[2px] bg-primary"
              />

              {t("home.tooltip")}
            </button>
          ) : null}
        </div>

      </header>


      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        person={person}
        userId={userId}
        circleId={circle.id}
        myName={members.find((m) => m.user_id === userId)?.name ?? ""}
        members={members}
        onPersonUpdated={refresh}
        geofence={{
          enabled: geofence.enabled,
          ...(geofence.reason ? { reason: geofence.reason } : {}),
          busy: geofence.busy,
          toggle: handleGeofenceToggle,
        }}
        onOpenPaywall={() => setPaywallOpen(true)}
      />

      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} />

      <Dialog open={askGeofence} onOpenChange={(o) => (o ? setAskGeofence(true) : closeGeofenceAsk())}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("geofence.askTitle")}</DialogTitle>
            <DialogDescription>
              {t("geofence.askBody", { name: pl(person?.name) || circle.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            <Button
              className="h-12 w-full rounded-2xl text-sm"
              onClick={() => {
                closeGeofenceAsk();
                handleGeofenceToggle(true);
              }}
            >
              {t("geofence.askYes")}
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full rounded-2xl text-sm"
              onClick={closeGeofenceAsk}
            >
              {t("geofence.askLater")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        code={circle.family_code}
      />


      {!online || pending.length > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm">
          {online ? <RefreshCw className="size-4" /> : <CloudOff className="size-4" />}
          <span>
            {pending.length > 0
              ? t("home.pendingSync", { n: String(pending.length) })
              : t("home.offline")}
          </span>
        </div>
      ) : null}

      <section className="relative rounded-3xl border border-primary/40 bg-transparent px-3 py-4">
        {isPremium ? (
          <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2.5 py-1 text-[0.62rem] leading-none font-medium text-primary-foreground shadow-soft">
            {t("home.premiumBadge")}
          </span>
        ) : isTrialActive ? (
          <span className="absolute -top-2.5 left-3 rounded-full border border-primary/30 bg-card px-2.5 py-1 text-[0.62rem] leading-none font-medium text-primary shadow-soft">
            {trialDaysLeft === 1
              ? t("home.trialLeftOne")
              : t("home.trialLeft", { n: String(trialDaysLeft) })}
          </span>
        ) : null}
        <h2 className="mb-3 text-center text-lg leading-tight text-primary">{t("home.overview")}</h2>
        <DotGrid days={days} timeZone={tz} onSelect={setSelectedDay} />
      </section>



      <section className="mt-3 rounded-2xl bg-card px-3 py-2 shadow-soft">
        {nextPlanned ? (
          (() => {
            const plannedMember = members.find((m) => m.user_id === nextPlanned.user_id);
            const hex = colorById(plannedMember?.personal_color).hex;
            const summary = activitySummary(nextPlanned.activities, t, nextPlanned.activity_note);
            return (
              <div className="flex items-center gap-2">
                <div
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                  style={{ backgroundColor: hex }}
                >
                  <span className="text-xs font-bold leading-none">
                    {plannedMember?.name.trim().charAt(0).toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[0.55rem] font-medium uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="size-2.5" />
                    {t("home.next")}
                  </p>
                  <p className="truncate text-[0.7rem] font-semibold text-foreground">
                    {plannedMember?.name ?? t("member.fallback")}
                    <span className="mx-1 text-muted-foreground">·</span>
                    {relativeLabel(nextPlanned.planned_date, tz)}
                  </p>
                  {summary ? (
                    <p className="truncate text-[0.6rem] text-muted-foreground">
                      {summary}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })()
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("home.noPlanned")}
          </p>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-primary/30 px-4 py-3">
        <p className="mb-2.5 text-[0.62rem] font-medium uppercase tracking-[0.2em] text-primary/60">
          {t("home.who")}
        </p>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => {
            const hex = colorById(m.personal_color).hex;
            const isMe = m.user_id === userId;
            return (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
                style={{ borderColor: hex, backgroundColor: `${hex}1f` }}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full text-[0.62rem] font-semibold text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                  style={{ backgroundColor: hex }}
                >
                  {m.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="text-xs font-medium leading-tight">
                  {m.name}
                  {isMe ? (
                    <span className="ml-1 font-normal text-muted-foreground">{t("home.you")}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>






      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-5 pb-8 pt-6">
        <Button
          onClick={handleImHere}
          disabled={busy || !person}
          className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground shadow-lift hover:bg-primary/90"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : locked ? (
            <Lock className="size-4" />
          ) : (
            <MapPinCheckInside className="size-5" />
          )}
          {t("home.imHere")}
        </Button>
        <div className="mt-2 flex gap-2">
          <Button
            className="h-12 flex-1 rounded-2xl bg-primary text-base text-primary-foreground shadow-lift hover:bg-primary/90"
            onClick={() => {
              if (locked) {
                setPaywallOpen(true);
                return;
              }
              resetActs();
              setPlanDate(null);
              setPlanOpen(true);
            }}
            aria-label={locked ? t("access.locked") : undefined}
          >
            {locked ? <Lock className="size-4" /> : <Plus className="size-4" />} {t("home.plan")}
          </Button>
          {locked ? (
            <Button
              aria-label={t("access.locked")}
              onClick={() => setPaywallOpen(true)}
              className="relative size-12 shrink-0 rounded-2xl bg-brand-accent text-brand-accent-foreground shadow-lift hover:bg-brand-accent/90"
            >
              <MessageCircle className="size-5" />
              <Lock className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
            </Button>
          ) : (
            <Button
              asChild
              aria-label={
                unread > 0
                  ? `${t("home.chatAria")} – ${t("home.unread", { n: String(unread) })}`
                  : t("home.chatAria")
              }
              className="relative size-12 shrink-0 rounded-2xl bg-brand-accent text-brand-accent-foreground shadow-lift hover:bg-brand-accent/90"
            >
              <Link to="/chat">
                <MessageCircle className="size-5" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-destructive-foreground shadow-soft">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            </Button>
          )}

        </div>


      </div>

      <DayDetail
        day={selectedDay}
        timeZone={tz}
        visits={visits}
        planned={planned}
        members={members}
        currentUserId={userId}
        onClose={() => setSelectedDay(null)}
        onDeleteVisit={async (id) => {
          await supabase.from("visits").delete().eq("id", id);
          setSelectedDay(null);
          refresh();
        }}
        onCancelPlanned={async (id) => {
          await supabase.from("planned_visits").update({ status: "cancelled" }).eq("id", id);
          setSelectedDay(null);
          refresh();
        }}
        onCompletePlanned={completePlanned}
      />

      <Dialog
        open={planOpen}
        onOpenChange={(o) => {
          setPlanOpen(o);
          if (!o) {
            setPlanCalendarOpen(false);
            setPlanDate(null);
            resetActs();
          }
        }}
      >
        <DialogContent className="gap-3 rounded-3xl p-4 sm:max-w-md">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-lg">{t("home.planTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{t("home.planDesc")}</DialogDescription>
          </DialogHeader>
          <ActivityPicker selected={acts} onChange={setActs} note={actNote} onNoteChange={setActNote} compact />
          <div className="grid grid-cols-2 gap-1.5">
            {planDates.slice(0, 6).map((d) => {
              const selected = d === planDate;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setPlanDate(d);
                    setPlanCalendarOpen(false);
                  }}
                  className={cn(
                    "min-h-10 rounded-2xl px-2.5 text-xs transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"
                  )}
                >
                  {relativeLabel(d, tz)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPlanCalendarOpen((s) => !s)}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-xs transition-colors",
              planCalendarOpen ? "bg-secondary" : "bg-transparent hover:bg-secondary/50"
            )}
          >
            <span className="font-medium text-foreground">
              {planCalendarOpen ? t("home.planLess") : t("home.planMore")}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                planCalendarOpen && "rotate-180"
              )}
            />
          </button>
          {planCalendarOpen ? (
            <div className="rounded-2xl border p-2">
              <Calendar
                mode="single"
                weekStartsOn={1}
                disabled={{ before: new Date() }}
                selected={planDate ? parseKey(planDate) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  setPlanDate(key);
                  setPlanCalendarOpen(false);
                }}
                className="pointer-events-auto"
              />
            </div>
          ) : null}
          {planDate ? (
            <div className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-3 py-2 text-xs">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              <span className="text-foreground">
                {relativeLabel(planDate, tz)}
              </span>
              <button
                type="button"
                onClick={() => setPlanDate(null)}
                className="ml-auto text-[0.65rem] text-muted-foreground underline underline-offset-2"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : null}
          <Button
            onClick={() => planDate && planVisit(planDate)}
            disabled={!planDate}
            className="w-full rounded-2xl bg-primary py-5 text-sm font-semibold text-primary-foreground shadow-lift hover:bg-primary/90 disabled:opacity-50"
          >
            {t("home.planRegister")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={familyOpen} onOpenChange={setFamilyOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("home.family")}</DialogTitle>
            <DialogDescription>{t("home.familyCode", { code: circle.family_code })}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                <span
                  className="size-5 rounded-full"
                  style={{ backgroundColor: colorById(m.personal_color).hex }}
                />
                <span className="text-sm font-medium">{m.name}</span>
                {m.user_id === userId ? (
                  <span className="text-xs text-muted-foreground">{t("home.you")}</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("home.visitsCount", {
                    n: String(visits.filter((v) => v.user_id === m.user_id).length),
                  })}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="h-12 rounded-2xl" onClick={invite}>
            <Share2 className="size-4" /> {t("home.inviteBtn")}
          </Button>


        </DialogContent>
      </Dialog>

      <Dialog open={confirmSecond} onOpenChange={setConfirmSecond}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("home.dupTitle")}</DialogTitle>
            <DialogDescription>
              {t("home.dupDesc", { name: pl(person?.name) || circle.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 flex-1 rounded-2xl" onClick={() => setConfirmSecond(false)}>
              {t("common.no")}
            </Button>
            <Button
              className="h-12 flex-1 rounded-2xl"
              onClick={() => {
                setConfirmSecond(false);
                void saveVisit("manual");
              }}
            >
              {t("home.dupYes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmVisit} onOpenChange={setConfirmVisit}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("home.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("home.confirmDesc", { name: pl(person?.name) || circle.name })}
            </DialogDescription>
          </DialogHeader>
          <ActivityPicker selected={acts} onChange={setActs} note={actNote} onNoteChange={setActNote} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-12 flex-1 rounded-2xl"
              onClick={() => setConfirmVisit(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="h-12 flex-1 rounded-2xl"
              onClick={() => {
                setConfirmVisit(false);
                void saveVisit("manual");
              }}
            >
              {t("home.confirmYes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
