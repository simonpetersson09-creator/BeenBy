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
 * 28 days ending today, aligned so every row is a Monday–Sunday week.
 * Returns 28 day keys (4 full weeks) where the last week contains today.
 */
export function build28DayGrid(timeZone: string): string[] {
  const today = todayKey(timeZone);
  const endOfWeek = addDays(today, 6 - weekdayIndex(today)); // Sunday of current week
  const start = addDays(endOfWeek, -27);
  return Array.from({ length: 28 }, (_, i) => addDays(start, i));
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
