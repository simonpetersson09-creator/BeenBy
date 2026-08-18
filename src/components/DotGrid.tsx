import { buildVisitGrid, weekdayLabels, shortLabel, todayKey, weekNumber } from "@/lib/dates";
import { useT } from "@/lib/i18n";
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
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? "";

  return buildVisitGrid(timeZone).map((day) => ({
    day,
    done: visits
      .filter((v) => v.local_day === day)
      .map((v) => ({ id: v.id, color: colorOf(v.user_id), who: nameOf(v.user_id) })),
    planned: planned
      .filter((p) => p.planned_date === day && p.status === "planned")
      .map((p) => ({ id: p.id, color: colorOf(p.user_id), who: nameOf(p.user_id) })),
  }));
}

function fillStyle(colors: string[]) {
  if (colors.length === 1) return { backgroundColor: colors[0] };
  const step = 100 / colors.length;
  const stops = colors
    .map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`)
    .join(", ");
  return { backgroundImage: `conic-gradient(from -90deg, ${stops})` };
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
  const t = useT();
  const today = todayKey(timeZone);
  const weeks: DayDots[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <div className="w-6 shrink-0" />

        <div className="grid flex-1 grid-cols-7 gap-x-1">
          {weekdayLabels().map((label, i) => (
            <div
              key={i}
              className="text-center text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground/70"
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-0.5">
        {weeks.map((week, wi) => {
          const isCurrentWeek = week.some((d) => d.day === today);
          return (
            <div
              key={week[0]!.day}
              className={cn(
                "flex items-center gap-1 rounded-xl pr-0.5 transition",
                isCurrentWeek && "bg-primary/10 ring-1 ring-primary/25",
              )}
            >
              <span
                className={cn(
                  "w-6 shrink-0 text-center text-[0.55rem] font-semibold uppercase tracking-[0.04em]",
                  isCurrentWeek ? "text-primary" : "text-muted-foreground/70",
                )}
              >
                {t("grid.weekPrefix")}
                {weekNumber(week[0]!.day)}
              </span>
              <div className="grid flex-1 grid-cols-7 gap-x-0.5">

                {week.map((d, di) => {
                  const index = wi * 7 + di;
                  const isToday = d.day === today;
                  const doneColors = d.done.map((x) => x.color);
                  const plannedColors = d.planned.map((x) => x.color);
                  const hasDone = doneColors.length > 0;
                  const hasPlanned = plannedColors.length > 0;
                  const label =
                    d.done.length + d.planned.length === 0
                      ? t("grid.ariaNone", { date: shortLabel(d.day) })
                      : t("grid.ariaSome", {
                          date: shortLabel(d.day),
                          done: String(d.done.length),
                          planned: String(d.planned.length),
                        });

                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => onSelect(d.day)}
                      aria-label={label}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "group flex min-h-8 items-center justify-center rounded-xl transition",
                        "active:scale-90",
                      )}
                    >
                      <span className="relative flex size-7 items-center justify-center">
                        {isToday ? (
                          <span className="pointer-events-none absolute inset-0 animate-breathe rounded-full border border-primary/50" />
                        ) : null}

                        <span
                          className={cn(
                            "animate-dot-pop block size-6 rounded-full transition",

                            "group-hover:scale-105",
                            !hasDone && !hasPlanned && "bg-white/45 ring-1 ring-foreground/[0.06]",
                            hasDone && "shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]",
                          )}
                          style={{
                            animationDelay: `${index * 12}ms`,
                            ...(hasDone
                              ? fillStyle(doneColors)
                              : hasPlanned
                                ? {
                                    border: `2px dashed ${plannedColors[0]}`,
                                    backgroundColor: "transparent",
                                  }
                                : {}),
                          }}
                        />

                        {hasDone && hasPlanned ? (
                          <span
                            className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed"
                            style={{ borderColor: plannedColors[0] }}
                          />
                        ) : null}

                        {d.done.length + d.planned.length > 3 ? (
                          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-card px-1 text-[0.55rem] font-semibold leading-[0.9rem] text-muted-foreground shadow-soft">
                            {d.done.length + d.planned.length}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


