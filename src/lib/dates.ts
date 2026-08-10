/**
 * All day grouping happens in the family circle's timezone so a visit at 23:55
 * and one at 00:05 land on the correct respective days, regardless of the
 * phone's own settings, DST or year boundaries.
 */

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

export const WEEKDAY_LABELS = ["M", "T", "O", "T", "F", "L", "S"];

/**
 * 28 days: the two previous weeks, the current week and the coming week.
 * Every row is a Monday–Sunday week.
 */
export function build28DayGrid(timeZone: string): string[] {
  const today = todayKey(timeZone);
  const mondayThisWeek = addDays(today, -weekdayIndex(today));
  const start = addDays(mondayThisWeek, -14);
  return Array.from({ length: 28 }, (_, i) => addDays(start, i));
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
  if (key === today) return "Idag";
  if (key === addDays(today, -1)) return "Igår";
  if (key === addDays(today, 1)) return "Imorgon";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dt);
}

export function shortLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(dt);
}
