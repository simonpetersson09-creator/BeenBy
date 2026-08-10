import { build28DayGrid, WEEKDAY_LABELS, shortLabel, todayKey } from "@/lib/dates";
import { colorById } from "@/lib/palette";
import { cn } from "@/lib/utils";
import type { Member, PlannedVisit, Visit } from "@/hooks/useCircleData";

export type DayDots = {
  day: string;
  done: { id: string; color: string; who: string }[];
  planned: { id: string; color: string; who: string }[];
};

export function buildDays(
  timeZone: string,
  visits: Visit[],
  planned: PlannedVisit[],
  members: Member[],
): DayDots[] {
  const colorOf = (userId: string) => colorById(members.find((m) => m.user_id === userId)?.personal_color).hex;
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? "Familjemedlem";

  return build28DayGrid(timeZone).map((day) => ({
    day,
    done: visits
      .filter((v) => v.local_day === day)
      .map((v) => ({ id: v.id, color: colorOf(v.user_id), who: nameOf(v.user_id) })),
    planned: planned
      .filter((p) => p.planned_date === day && p.status === "planned")
      .map((p) => ({ id: p.id, color: colorOf(p.user_id), who: nameOf(p.user_id) })),
  }));
}

function Dot({ color, filled }: { color: string; filled: boolean }) {
  return (
    <span
      className="block size-2.5 rounded-full"
      style={
        filled
          ? { backgroundColor: color }
          : { border: `2px solid ${color}`, backgroundColor: "transparent" }
      }
    />
  );
}

export function DotGrid({
  days,
  timeZone,
  onSelect,
}: {
  days: DayDots[];
  timeZone: string;
  onSelect: (day: string) => void;
}) {
  const today = todayKey(timeZone);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[0.7rem] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isToday = d.day === today;
          const isFuture = d.day > today;
          const dots = [
            ...d.done.map((x) => ({ ...x, filled: true })),
            ...d.planned.map((x) => ({ ...x, filled: false })),
          ];
          const label =
            dots.length === 0
              ? `${shortLabel(d.day)}, inget besök`
              : `${shortLabel(d.day)}, ${d.done.length} genomförda, ${d.planned.length} planerade`;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => onSelect(d.day)}
              aria-label={label}
              className={cn(
                // hit area is deliberately larger than the visual dots
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl transition",
                "hover:bg-secondary active:scale-95",
                isToday && "bg-secondary ring-2 ring-primary/60",
                isFuture && !isToday && "opacity-70",
              )}
            >
              {dots.length === 0 ? (
                <span className="block size-2.5 rounded-full bg-border" />
              ) : (
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {dots.slice(0, 4).map((dot) => (
                    <Dot key={dot.id} color={dot.color} filled={dot.filled} />
                  ))}
                </span>
              )}
              {dots.length > 4 ? (
                <span className="text-[0.6rem] leading-none text-muted-foreground">+{dots.length - 4}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
