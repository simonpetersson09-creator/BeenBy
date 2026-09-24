/**
 * Optional activities attached to a visit or a planned visit.
 *
 * The ids are stable, language-independent strings stored in
 * `visits.activities` / `planned_visits.activities` (text[]), so they can later
 * be aggregated for statistics ("who usually handles the medicines?") without
 * depending on the UI language. `"other"` may be paired with a short free-text
 * note stored in `activity_note`.
 */
import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  HeartPulse,
  Home,
  MessageCircle,
  Pill,
  Plus,
  ShoppingCart,
} from "lucide-react";

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
  /** Monochrome icon; inherits the surrounding text color (currentColor). */
  icon: LucideIcon;
  /** i18n key holding the human label. */
  key: string;
};

export const ACTIVITIES: ActivityDef[] = [
  { id: "greet", icon: MessageCircle, key: "act.greet" },
  { id: "meds", icon: Pill, key: "act.meds" },
  { id: "shop", icon: ShoppingCart, key: "act.shop" },
  { id: "bills", icon: CreditCard, key: "act.bills" },
  { id: "care", icon: HeartPulse, key: "act.care" },
  { id: "home", icon: Home, key: "act.home" },
  { id: "other", icon: Plus, key: "act.other" },
];

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id as string, a]));

export function activityDef(id: string): ActivityDef | undefined {
  return BY_ID.get(id);
}

/**
 * "Mediciner · Handla" — unknown ids are skipped so old rows and future
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
      if (def.id === "other" && note?.trim()) return note.trim();
      return t(def.key);
    })
    .filter(Boolean) as string[];
  return list.join(" · ");
}
