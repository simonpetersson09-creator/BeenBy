import { Trash2 } from "lucide-react";

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

import { useT } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import type { Member, PlannedVisit, Visit } from "@/hooks/useCircleData";

export function DayDetail({
  day,
  timeZone,
  visits,
  planned,
  members,
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
  currentUserId: string;
  onClose: () => void;
  onDeleteVisit: (id: string) => void;
  onCancelPlanned: (id: string) => void;
  onCompletePlanned: (p: PlannedVisit) => void;
}) {
  const t = useT();
  const dayVisits = day ? visits.filter((v) => v.local_day === day) : [];
  const dayPlanned = day ? planned.filter((p) => p.planned_date === day && p.status === "planned") : [];
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? t("member.fallback");
  const hexOf = (userId: string) =>
    colorById(members.find((m) => m.user_id === userId)?.personal_color).hex;

  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{day ? relativeLabel(day, timeZone) : ""}</DialogTitle>
          <DialogDescription>
            {dayVisits.length === 0 && dayPlanned.length === 0
              ? t("day.none")
              : t("day.some")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {dayVisits.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              <span className="size-4 rounded-full" style={{ backgroundColor: hexOf(v.user_id) }} />
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
              <span
                className="size-4 rounded-full"
                style={{ border: `2px solid ${hexOf(p.user_id)}` }}
              />
              <span className="flex-1 text-sm">
                <span className="font-medium">{nameOf(p.user_id)}</span> {t("day.plansVisit")}
                <span className="block text-xs text-muted-foreground">
                  {activitySummary(p.activities, t, p.activity_note) || t("day.planned")}
                </span>
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
                    onClick={() => onCancelPlanned(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
