import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { addDays, buildVisitGrid, weekdayLabels, shortLabel, todayKey, weekNumber } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { colorById } from "@/lib/palette";
import { cn } from "@/lib/utils";
import type { CircleEvent, Member, PlannedVisit, Visit } from "@/hooks/useCircleData";
import { eventEmoji, occursOn } from "@/lib/events";
import { activityDef } from "@/lib/activities";

export type DayDots = {
  day: string;
  done: { id: string; color: string; who: string; icon: string | null }[];
  planned: { id: string; color: string; who: string; icon: string | null }[];
  events: { id: string; kind: string }[];
};

/** Extra future weeks so the grid can be scrolled forward (never further back). */
const EXTRA_FUTURE_WEEKS = 8;

export function buildDays(
  timeZone: string,
  visits: Visit[],
  planned: PlannedVisit[],
  members: Member[],
  events: CircleEvent[] = [],
): DayDots[] {
  const colorOf = (userId: string) => colorById(members.find((m) => m.user_id === userId)?.personal_color).hex;
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? "";

  const base = buildVisitGrid(timeZone);
  const last = base[base.length - 1]!;
  const all = [...base, ...Array.from({ length: EXTRA_FUTURE_WEEKS * 7 }, (_, i) => addDays(last, i + 1))];
  const iconOf = (ids: string[] | null | undefined) => {
    const first = (ids ?? []).map((id) => activityDef(id)?.emoji).find(Boolean);
    return first ?? null;
  };
  return all.map((day) => ({
    day,
    done: visits
      .filter((v) => v.local_day === day)
      .map((v) => ({ id: v.id, color: colorOf(v.user_id), who: nameOf(v.user_id), icon: iconOf(v.activities) })),
    planned: planned
      .filter((p) => p.planned_date === day && p.status === "planned")
      .map((p) => ({ id: p.id, color: colorOf(p.user_id), who: nameOf(p.user_id), icon: iconOf(p.activities) })),
    events: events.filter((e) => occursOn(e, day)).map((e) => ({ id: e.id, kind: e.kind })),
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  };

  const weeks: DayDots[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <div className="w-9 shrink-0" />

        <div className="grid flex-1 grid-cols-7 gap-x-1">
          {weekdayLabels().map((label, i) => (
            <div
              key={i}
              className="text-center text-[0.82rem] font-bold uppercase tracking-[0.12em] text-primary"
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[212px] space-y-0.5 overflow-y-auto overscroll-contain"
        >
          {weeks.map((week, wi) => {
            const isCurrentWeek = week.some((d) => d.day === today);
            return (
              <div
                key={week[0]!.day}
                className={cn(
                  "mx-1 flex items-center gap-1 rounded-xl px-2 transition",
                  isCurrentWeek && "bg-primary/10 ring-1 ring-primary/25",
                )}
              >
                <span
                  className={cn(
                    "w-9 shrink-0 text-center text-[0.72rem] font-semibold uppercase tracking-[0.04em]",
                    isCurrentWeek ? "font-bold text-primary" : "text-primary/70",
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
                          "group flex min-h-10 items-center justify-center rounded-xl transition",
                          "active:scale-90",
                        )}
                      >
                        <span className="relative flex size-8 items-center justify-center">
                          {isToday ? (
                            <span className="pointer-events-none absolute inset-0 animate-breathe rounded-full border border-primary/50" />
                          ) : null}

                          <span
                            className={cn(
                              "animate-dot-pop block size-7 rounded-full transition",
                              "group-hover:scale-105",
                              !hasDone && !hasPlanned && "border border-foreground/10 bg-card/55",
                              hasDone && "shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]",
                            )}
                            style={{
                              animationDelay: `${index * 12}ms`,
                              ...(hasDone
                                ? fillStyle(doneColors)
                                : hasPlanned
                                  ? {
                                      border: `2px dashed ${plannedColors[0]}`,
                                      backgroundColor: `${plannedColors[0]}15`,
                                    }
                                  : {}),
                            }}
                          />

                          {hasDone && hasPlanned ? (
                            <span
                              className="pointer-events-none absolute -inset-0.5 rounded-full border-2 border-dashed"
                              style={{ borderColor: plannedColors[0] }}
                            />
                          ) : null}

                          {(() => {
                            // Max one icon per day: an event wins, otherwise the
                            // first activity of the day's done/planned visit.
                            const icon =
                              d.events.length > 0
                                ? eventEmoji(d.events[0]!.kind)
                                : (d.done.find((x) => x.icon)?.icon ??
                                  d.planned.find((x) => x.icon)?.icon ??
                                  null);
                            return icon ? (
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 grid place-items-center"
                              >
                                <span className="block size-[1em] text-center text-[0.72rem] leading-[1em]">
                                  {icon}
                                </span>
                              </span>
                            ) : null;
                          })()}

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

        {!atEnd ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <ChevronDown
              className="animate-pulse-soft size-4 text-primary/60"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[0.6rem] text-foreground">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className="block size-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: "#F97316" }}
          />
          {t("home.legend.done")}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className="block size-3 rounded-full border-2 border-dashed"
            style={{ borderColor: "#F97316", backgroundColor: "#F9731615" }}
          />
          {t("home.legend.planned")}
        </span>
      </div>
    </div>
  );
}


