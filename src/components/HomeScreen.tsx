import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CloudOff, Loader2, MapPinCheckInside, MessageCircle, Plus, RefreshCw, Settings, Share2, Users } from "lucide-react";
import { toast } from "sonner";


import { DayDetail } from "@/components/DayDetail";
import { DotGrid, buildDays } from "@/components/DotGrid";
import { InviteSheet } from "@/components/InviteSheet";
import { SettingsDialog } from "@/components/SettingsDialog";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CircleData, PlannedVisit } from "@/hooks/useCircleData";
import { useOnlineStatus } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { addDays, relativeLabel, todayKey } from "@/lib/dates";
import { dequeue, enqueue, getPending, newClientToken, type PendingVisit } from "@/lib/offline";
import { colorById } from "@/lib/palette";
import { saveRecovery } from "@/lib/recovery";

export function HomeScreen({
  data,
  userId,
  refresh,
}: {
  data: CircleData;
  userId: string;
  refresh: () => void;
}) {
  const { circle, person, members, visits, planned } = data;
  const tz = circle.timezone;
  const online = useOnlineStatus();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmSecond, setConfirmSecond] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);


  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingVisit[]>([]);

  useEffect(() => {
    const sync = () => setPending(getPending());
    sync();
    window.addEventListener("pending-visits-changed", sync);
    return () => window.removeEventListener("pending-visits-changed", sync);
  }, []);

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
    const items = getPending();
    for (const item of items) {
      const { error } = await supabase.from("visits").insert({
        family_circle_id: item.familyCircleId,
        person_id: item.personId,
        user_id: userId,
        visited_at: item.visitedAt,
        local_day: item.localDay,
        source: item.source,
        client_token: item.clientToken,
      });
      // 23505 = the same visit already reached the server; safe to drop.
      if (!error || error.code === "23505") dequeue(item.clientToken);
    }
    if (items.length > 0) refresh();
  }, [refresh, userId]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  async function saveVisit(source: string) {
    if (!person) return;
    if (busy) return;
    setBusy(true);
    const clientToken = newClientToken();
    const item: PendingVisit = {
      clientToken,
      familyCircleId: circle.id,
      personId: person.id,
      visitedAt: new Date().toISOString(),
      localDay: todayKey(tz),
      source,
    };

    if (!navigator.onLine) {
      enqueue(item);
      setBusy(false);
      toast.message("Sparat på telefonen", {
        description: "Besöket synkas så snart du är uppkopplad igen.",
      });
      return;
    }

    const { data: inserted, error } = await supabase
      .from("visits")
      .insert({
        family_circle_id: item.familyCircleId,
        person_id: item.personId,
        user_id: userId,
        visited_at: item.visitedAt,
        local_day: item.localDay,
        source: item.source,
        client_token: item.clientToken,
      })
      .select("id")
      .maybeSingle();
    setBusy(false);

    if (error) {
      if (error.code === "23505") return; // duplicate double-tap, nothing to do
      enqueue(item);
      toast.message("Ingen anslutning", { description: "Besöket synkas när nätet är tillbaka." });
      return;
    }

    refresh();
    toast.success("Besök registrerat ✓", {
      duration: 6000,
      action: inserted
        ? {
            label: "Ångra",
            onClick: async () => {
              await supabase.from("visits").delete().eq("id", inserted.id);
              refresh();
            },
          }
        : undefined,
    });
  }

  function handleImHere() {
    if (myVisitToday) {
      setConfirmSecond(true);
      return;
    }
    void saveVisit("manual");
  }

  async function planVisit(date: string) {
    if (!person) return;
    setPlanOpen(false);
    const { error } = await supabase.from("planned_visits").insert({
      family_circle_id: circle.id,
      person_id: person.id,
      user_id: userId,
      planned_date: date,
    });
    if (error) {
      toast.error("Det gick inte att spara det planerade besöket.");
      return;
    }
    refresh();
    toast.success(`Planerat besök ${relativeLabel(date, tz).toLowerCase()}`);
  }

  async function completePlanned(p: PlannedVisit) {
    await supabase.from("visits").insert({
      family_circle_id: circle.id,
      person_id: p.person_id,
      user_id: userId,
      visited_at: new Date().toISOString(),
      local_day: p.planned_date,
      source: "confirmed_planned_visit",
      client_token: newClientToken(),
    });
    await supabase.from("planned_visits").update({ status: "completed" }).eq("id", p.id);
    setSelectedDay(null);
    refresh();
    toast.success("Besök registrerat ✓");
  }

  async function invite() {
    setInviteUrl(null);
    setInviteOpen(true);
    const { data: inv, error } = await supabase
      .from("invitations")
      .insert({ family_circle_id: circle.id, created_by: userId })
      .select("invite_token")
      .single();
    if (error || !inv) {
      setInviteOpen(false);
      toast.error("Det gick inte att skapa en inbjudan just nu.");
      return;
    }
    setInviteUrl(`${window.location.origin}/join/${inv.invite_token}`);
  }

  const planDates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-40 pt-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-primary/60">
            Besöken hos
          </p>
          <h1 className="mt-1 truncate text-[2rem] leading-[1.1] text-primary">
            {person?.name ?? circle.name}
          </h1>
          <span className="mt-2 block h-px w-10 bg-primary/30" />
        </div>
        <div className="relative flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Familjen" onClick={() => setFamilyOpen(true)}>
            <Users className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Inställningar"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-5" />
          </Button>

          {members.length === 1 ? (
            <button
              type="button"
              onClick={() => setFamilyOpen(true)}
              className="absolute right-0 top-full z-20 mt-2 w-56 animate-in fade-in slide-in-from-top-1 rounded-2xl bg-primary px-3 py-2 text-left text-[0.7rem] leading-snug text-primary-foreground shadow-lift"
            >
              <span
                aria-hidden
                className="absolute -top-1.5 right-[3.6rem] size-3 rotate-45 rounded-[2px] bg-primary"
              />

              Tryck här för att bjuda in dina syskon – så ser ni varandras besök direkt.
            </button>
          ) : null}
        </div>

      </header>


      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        url={inviteUrl}
        message={`Följ med och håll koll på besöken hos ${person?.name ?? circle.name}.`}
      />


      {!online || pending.length > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm">
          {online ? <RefreshCw className="size-4" /> : <CloudOff className="size-4" />}
          <span>
            {pending.length > 0
              ? `${pending.length} besök väntar på synkronisering`
              : "Ingen anslutning – allt du gör sparas och synkas sedan"}
          </span>
        </div>
      ) : null}

      <section className="rounded-3xl border border-primary/40 bg-transparent px-3 py-4">
        <h2 className="mb-3 text-center text-base leading-tight text-primary">Besöksöversikt</h2>
        <DotGrid days={days} timeZone={tz} onSelect={setSelectedDay} />
        <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-primary/25 pt-3 text-[0.68rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-foreground/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]" />
            Fylld = besökt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-dashed border-foreground/50" />
            Streckad = planerat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-foreground/[0.07]" />
            Tom = inget besök
          </span>
          <span className="w-full text-center text-[0.65rem] text-muted-foreground/80">
            Färgen visar vem i familjen det är.
          </span>
        </div>
      </section>



      <section className="mt-4 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        {nextPlanned ? (
          <p className="flex items-center gap-2 text-xs">
            <span
              className="size-3 rounded-full"
              style={{
                border: `2px solid ${colorById(members.find((m) => m.user_id === nextPlanned.user_id)?.personal_color).hex}`,
              }}
            />
            <span>
              Nästa besök:{" "}
              <span className="font-medium">
                {members.find((m) => m.user_id === nextPlanned.user_id)?.name ?? "Någon"}
              </span>{" "}
              {relativeLabel(nextPlanned.planned_date, tz).toLowerCase()}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Inget besök är planerat än. Planera gärna ett – det syns direkt för de andra.
          </p>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-primary/30 px-4 py-3">
        <p className="mb-2 text-[0.62rem] font-medium uppercase tracking-[0.2em] text-primary/60">
          Vem är vem
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-xs">
              <span
                className="size-3.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                style={{ backgroundColor: colorById(m.personal_color).hex }}
              />
              <span className={m.user_id === userId ? "font-medium" : undefined}>
                {m.name}
                {m.user_id === userId ? " (du)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>





      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-5 pb-8 pt-6">
        <Button
          onClick={handleImHere}
          disabled={busy || !person}
          className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground shadow-lift hover:bg-primary/90"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MapPinCheckInside className="size-5" />
          )}
          Jag är här
        </Button>
        <div className="mt-2 flex gap-2">
          <Button
            className="h-12 flex-1 rounded-2xl bg-primary text-base text-primary-foreground shadow-lift hover:bg-primary/90"
            onClick={() => setPlanOpen(true)}
          >
            <Plus className="size-4" /> Planera ett besök
          </Button>
          <Button
            asChild
            aria-label="Skriv en kommentar"
            className="size-12 shrink-0 rounded-2xl bg-brand-accent text-brand-accent-foreground shadow-lift hover:bg-brand-accent/90"
          >
            <Link to="/chat">
              <MessageCircle className="size-5" />
            </Link>
          </Button>

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

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Planera ett besök</DialogTitle>
            <DialogDescription>Välj vilken dag du tänker hälsa på.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
            {planDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => planVisit(d)}
                className="min-h-12 rounded-2xl bg-secondary px-3 text-sm hover:bg-accent"
              >
                {relativeLabel(d, tz)}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={familyOpen} onOpenChange={setFamilyOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Familjen</DialogTitle>
            <DialogDescription>Familjekod: {circle.family_code}</DialogDescription>
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
                  <span className="text-xs text-muted-foreground">(du)</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {visits.filter((v) => v.user_id === m.user_id).length} besök
                </span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="h-12 rounded-2xl" onClick={invite}>
            <Share2 className="size-4" /> Bjud in någon
          </Button>


        </DialogContent>
      </Dialog>

      <Dialog open={confirmSecond} onOpenChange={setConfirmSecond}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Du har redan registrerat idag</DialogTitle>
            <DialogDescription>
              Vill du registrera ytterligare ett besök hos {person?.name ?? circle.name} idag?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 flex-1 rounded-2xl" onClick={() => setConfirmSecond(false)}>
              Nej
            </Button>
            <Button
              className="h-12 flex-1 rounded-2xl"
              onClick={() => {
                setConfirmSecond(false);
                void saveVisit("manual");
              }}
            >
              Ja, registrera
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
