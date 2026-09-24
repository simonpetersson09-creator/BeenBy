import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Cake, MapPin, Pill, Stethoscope } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { CircleEvent } from "@/hooks/useCircleData";
import { decryptText, encryptText, ensureCircleKey, getCircleKey, isEncrypted } from "@/lib/e2ee";

export type EventKind = "birthday" | "doctor" | "medicine" | "other";

export const EVENT_KINDS: { id: EventKind; icon: LucideIcon; key: string }[] = [
  { id: "birthday", icon: Cake, key: "event.birthday" },
  { id: "doctor", icon: Stethoscope, key: "event.doctor" },
  { id: "medicine", icon: Pill, key: "event.medicine" },
  { id: "other", icon: MapPin, key: "event.other" },
];

/** Monochrome icon for an event kind; inherits the surrounding text color. */
export function eventIcon(kind: string): LucideIcon {
  return EVENT_KINDS.find((k) => k.id === kind)?.icon ?? MapPin;
}

/** Yearly events (birthdays) match on month + day, others on the exact date. */
export function occursOn(e: CircleEvent, day: string): boolean {
  if (e.yearly) return e.event_date.slice(5) === day.slice(5);
  return e.event_date === day;
}

/** Titles are end-to-end encrypted with the circle key; decrypt on device only. */
export function useEventTitles(
  circleId: string,
  userId: string,
  events: CircleEvent[],
): Record<string, string | null> {
  const [titles, setTitles] = useState<Record<string, string | null>>({});
  const sig = events.map((e) => `${e.id}:${e.title?.length ?? 0}`).join(",");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const withTitle = events.filter((e) => e.title);
      if (withTitle.length === 0) {
        setTitles({});
        return;
      }
      const key = await getCircleKey(circleId, userId).catch(() => null);
      const next: Record<string, string | null> = {};
      for (const e of withTitle) {
        if (!isEncrypted(e.title)) next[e.id] = e.title;
        else next[e.id] = key ? await decryptText(key, e.title!) : null;
      }
      if (!cancelled) setTitles(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, userId, sig]);

  return titles;
}

export async function addEvent(input: {
  circleId: string;
  personId: string | null;
  userId: string;
  kind: EventKind;
  title: string;
  date: string;
  yearly: boolean;
}): Promise<{ error: unknown | null }> {
  let title: string | null = null;
  const plain = input.title.trim();
  if (plain) {
    const key = await ensureCircleKey(input.circleId, input.userId).catch(() => null);
    // Never store readable text on the server: without the family key we refuse.
    if (!key) return { error: new Error("no_circle_key") };
    title = await encryptText(key, plain);
  }
  const { error } = await supabase.from("circle_events").insert({
    family_circle_id: input.circleId,
    person_id: input.personId,
    created_by: input.userId,
    kind: input.kind,
    title,
    event_date: input.date,
    yearly: input.yearly,
  });
  return { error };
}
