import { useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activitySummary } from "@/lib/activities";
import { relativeLabel } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_KINDS, addEvent, eventIcon, occursOn, useEventTitles, type EventKind } from "@/lib/events";
import { cn } from "@/lib/utils";

import { useT } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import type { CircleEvent, Member, PlannedVisit, Visit } from "@/hooks/useCircleData";

function MemberAvatar({
  url,
  hex,
  outlined,
}: {
  url: string | undefined;
  hex: string;
  outlined?: boolean;
}) {
  return url ? (
    <span
      className="size-8 shrink-0 overflow-hidden rounded-full"
      style={outlined ? { border: `2px solid ${hex}` } : undefined}
    >
      <img src={url} alt="" className="size-full object-cover" />
    </span>
  ) : (
    <span
      className="size-4 shrink-0 rounded-full"
      style={outlined ? { border: `2px solid ${hex}` } : { backgroundColor: hex }}
    />
  );
}

export function DayDetail({
  day,
  timeZone,
  visits,
  planned,
  members,
  avatarUrls,
  events,
  circleId,
  personId,
  onChanged,
  currentUserId,
  onClose,
  onDeleteVisit,
  onCancelPlanned,
  onCompletePlanned,
}: {
  day: string | null;
  timeZone: string;
  visits: Visit[];
  planned: PlannedVisit[];
  members: Member[];
  avatarUrls: Record<string, string>;
  events: CircleEvent[];
  circleId: string;
  personId: string | null;
  onChanged: () => void;
  currentUserId: string;
  onClose: () => void;
  onDeleteVisit: (id: string) => void;
  onCancelPlanned: (p: PlannedVisit, allFuture: boolean) => void;
  onCompletePlanned: (p: PlannedVisit) => void;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<EventKind>("birthday");
  const [title, setTitle] = useState("");
  const [yearly, setYearly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelSeries, setCancelSeries] = useState<string | null>(null);
  const titles = useEventTitles(circleId, currentUserId, events);
  const dayEvents = day ? events.filter((e) => occursOn(e, day)) : [];
  const resetForm = () => {
    setAdding(false);
    setKind("birthday");
    setTitle("");
    setYearly(true);
    setCancelSeries(null);
  };
  async function save() {
    if (!day) return;
    setSaving(true);
    const { error } = await addEvent({
      circleId,
      personId,
      userId: currentUserId,
      kind,
      title,
      date: day,
      yearly,
    });
    setSaving(false);
    if (error) {
      toast.error(t("event.error"));
      return;
    }
    toast.success(t("event.saved"));
    resetForm();
    onChanged();
  }
  async function removeEvent(id: string) {
    await supabase.from("circle_events").delete().eq("id", id);
    onChanged();
  }
  const dayVisits = day ? visits.filter((v) => v.local_day === day) : [];
  const dayPlanned = day ? planned.filter((p) => p.planned_date === day && p.status === "planned") : [];
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? t("member.fallback");
  const hexOf = (userId: string) =>
    colorById(members.find((m) => m.user_id === userId)?.personal_color).hex;

  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{day ? relativeLabel(day, timeZone) : ""}</DialogTitle>
          <DialogDescription>
            {dayVisits.length === 0 && dayPlanned.length === 0 && dayEvents.length === 0
              ? t("day.none")
              : t("day.some")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {dayEvents.map((e) => {
            const label = t(EVENT_KINDS.find((k) => k.id === e.kind)?.key ?? "event.other");
            const text = e.title ? (titles[e.id] ?? t("event.locked")) : label;
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
                {(() => {
                  const Icon = eventIcon(e.kind);
                  return <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />;
                })()}
                <span className="flex-1 text-sm">
                  <span className="font-medium">{text}</span>
                  <span className="block text-xs text-muted-foreground">
                    {e.title ? label : null}
                    {e.title && e.yearly ? " · " : null}
                    {e.yearly ? t("event.everyYear") : null}
                  </span>
                </span>
                <Button variant="ghost" size="icon" aria-label={t("event.delete")} onClick={() => removeEvent(e.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
          {dayVisits.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              <MemberAvatar url={avatarUrls[v.user_id]} hex={hexOf(v.user_id)} />
              <span className="flex-1 text-sm">
                <span className="font-medium">{nameOf(v.user_id)}</span> {t("day.wasHere")}
                <span className="block text-xs text-muted-foreground">
                  {activitySummary(v.activities, t, v.activity_note) || t("day.done")}
                </span>
              </span>

              {v.user_id === currentUserId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("day.delMine")}
                  onClick={() => onDeleteVisit(v.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}

          {dayPlanned.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-dashed p-3">
              <MemberAvatar url={avatarUrls[p.user_id]} hex={hexOf(p.user_id)} outlined />
              <span className="flex-1 text-sm">
                <span className="font-medium">{nameOf(p.user_id)}</span> {t("day.plansVisit")}
                <span className="block text-xs text-muted-foreground">
                  {activitySummary(p.activities, t, p.activity_note) || t("day.planned")}
                  {p.series_id ? (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      · <Repeat className="size-3" /> {t("day.weekly")}
                    </span>
                  ) : null}
                </span>
                {cancelSeries === p.id ? (
                  <span className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => onCancelPlanned(p, false)}>
                      {t("day.cancelOne")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onCancelPlanned(p, true)}>
                      {t("day.cancelAll")}
                    </Button>
                  </span>
                ) : null}
              </span>

              {p.user_id === currentUserId ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => onCompletePlanned(p)}>
                    {t("day.markDone")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("day.delPlanned")}
                    onClick={() => (p.series_id ? setCancelSeries(p.id) : onCancelPlanned(p, false))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="space-y-3 rounded-2xl border p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {EVENT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setKind(k.id);
                    setYearly(k.id === "birthday");
                  }}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-1 rounded-2xl px-2 text-xs transition-colors",
                    kind === k.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
                  )}
                >
                  <k.icon className="size-3.5 shrink-0" aria-hidden="true" /> {t(k.key)}
                </button>
              ))}
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("event.titlePh")}
              maxLength={120}
              className="rounded-2xl"
            />
            <label className="flex items-center justify-between text-xs">
              <span>{t("event.yearly")}</span>
              <Switch checked={yearly} onCheckedChange={setYearly} />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 rounded-2xl" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1 rounded-2xl" onClick={save} disabled={saving}>
                {t("event.save")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="h-11 rounded-2xl" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t("event.add")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
