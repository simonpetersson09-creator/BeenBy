/**
 * Optional activities attached to a visit or a planned visit.
 *
 * The ids are stable, language-independent strings stored in
 * `visits.activities` / `planned_visits.activities` (text[]), so they can later
 * be aggregated for statistics ("who usually handles the medicines?") without
 * depending on the UI language. `"other"` may be paired with a short free-text
 * note stored in `activity_note`.
 */

export type ActivityId =
  | "greet"
  | "meds"
  | "shop"
  | "bills"
  | "care"
  | "home"
  | "other";

export type ActivityDef = {
  id: ActivityId;
  emoji: string;
  /** i18n key holding the human label. */
  key: string;
};

export const ACTIVITIES: ActivityDef[] = [
  { id: "greet", emoji: "💬", key: "act.greet" },
  { id: "meds", emoji: "💊", key: "act.meds" },
  { id: "shop", emoji: "🛒", key: "act.shop" },
  { id: "bills", emoji: "💳", key: "act.bills" },
  { id: "care", emoji: "🏥", key: "act.care" },
  { id: "home", emoji: "🏠", key: "act.home" },
  { id: "other", emoji: "➕", key: "act.other" },
];

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id as string, a]));

export function activityDef(id: string): ActivityDef | undefined {
  return BY_ID.get(id);
}

/**
 * "💊 Mediciner · 🛒 Handla" — unknown ids are skipped so old rows and future
 * additions never break an existing client.
 */
export function activitySummary(
  ids: string[] | null | undefined,
  t: (key: string) => string,
  note?: string | null,
): string {
  const list = (ids ?? [])
    .map((id) => {
      const def = activityDef(id);
      if (!def) return null;
      if (def.id === "other" && note?.trim()) return `${def.emoji} ${note.trim()}`;
      return `${def.emoji} ${t(def.key)}`;
    })
    .filter(Boolean) as string[];
  return list.join(" · ");
}
