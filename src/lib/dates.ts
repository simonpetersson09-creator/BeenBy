/**
 * All day grouping happens in the family circle's timezone so a visit at 23:55
 * and one at 00:05 land on the correct respective days, regardless of the
 * phone's own settings, DST or year boundaries.
 */
import { getLang, localeOf, translate } from "@/lib/i18n";

export function localDay(date: Date, timeZone: string): string {
  // sv-SE formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayKey(timeZone: string): string {
  return localDay(new Date(), timeZone);
}

/** Add days to a YYYY-MM-DD key without timezone drift. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday (Swedish week starts on Monday). */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const js = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return (js + 6) % 7;
}

/** Narrow weekday initials (Monday first) in the current app language. */
export function weekdayLabels(): string[] {
  const fmt = new Intl.DateTimeFormat(localeOf(), { timeZone: "UTC", weekday: "narrow" });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).toUpperCase(),
  );
}

/**
 * 35 days: the two previous weeks, the current week and the two coming weeks.
 * Every row is a Monday–Sunday week.
 */
export function buildVisitGrid(timeZone: string): string[] {
  const today = todayKey(timeZone);
  const mondayThisWeek = addDays(today, -weekdayIndex(today));
  const start = addDays(mondayThisWeek, -14);
  return Array.from({ length: 35 }, (_, i) => addDays(start, i));
}

/** ISO-8601 week number (Swedish "veckonummer"). */
export function weekNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  // Thursday of the current ISO week decides the year/week.
  dt.setUTCDate(dt.getUTCDate() + 3 - ((dt.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7),
  );
  return 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86400000));
}


export function isFuture(key: string, timeZone: string): boolean {
  return key > todayKey(timeZone);
}

export function relativeLabel(key: string, timeZone: string): string {
  const today = todayKey(timeZone);
  const lang = getLang();
  if (key === today) return translate(lang, "date.today");
  if (key === addDays(today, -1)) return translate(lang, "date.yesterday");
  if (key === addDays(today, 1)) return translate(lang, "date.tomorrow");
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat(localeOf(lang), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dt);
}

export function shortLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat(localeOf(), {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(dt);
}
