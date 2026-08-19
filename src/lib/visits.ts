/**
 * The ONE place a visit is written to the database.
 *
 * Both the "Jag är här" button and (later) the geofence arrival answer must go
 * through `recordVisit()` so there is never a second, slightly different insert
 * path. The behaviour here is exactly what HomeScreen did inline before:
 *
 * - a stable `client_token` per attempt, so a retry can never duplicate a visit
 * - offline → queue in `src/lib/offline.ts` (the only queue, never a new one)
 * - Postgres 23505 (unique violation) = the visit already reached the server
 * - any other error → queue it and let `flushPendingVisits()` retry later
 *
 * UI concerns (toasts, undo, paywall, dialogs) intentionally stay in the
 * caller — this module only decides what happens to the row.
 */
import { supabase } from "@/integrations/supabase/client";
import { todayKey } from "@/lib/dates";
import { dequeue, enqueue, getPending, newClientToken, type PendingVisit } from "@/lib/offline";

/** Free-text in the database; these are the values the app itself uses. */
export type VisitSource = "manual" | "geofence" | "confirmed_planned_visit" | (string & {});

export type RecordVisitInput = {
  familyCircleId: string;
  personId: string;
  userId: string;
  /** IANA timezone of the circle — decides which local day the visit lands on. */
  timezone: string;
  source: VisitSource;
  /** Optional override, e.g. a queued visit replayed later. Defaults to now. */
  visitedAt?: string;
  /** Optional override for the local day. Defaults to today in `timezone`. */
  localDay?: string;
  /** Optional activity ids (see src/lib/activities.ts). Empty = as before. */
  activities?: string[];
  /** Optional short free text when "other" is picked. */
  activityNote?: string | null;
};

export type RecordVisitResult =
  | { status: "saved"; visitId: string | null; clientToken: string }
  | { status: "duplicate"; clientToken: string }
  | { status: "queued"; reason: "offline" | "error"; clientToken: string };

function buildPending(input: RecordVisitInput): PendingVisit {
  return {
    clientToken: newClientToken(),
    familyCircleId: input.familyCircleId,
    personId: input.personId,
    visitedAt: input.visitedAt ?? new Date().toISOString(),
    localDay: input.localDay ?? todayKey(input.timezone),
    source: input.source,
    activities: input.activities ?? [],
    activityNote: input.activityNote ?? null,
  };
}

async function insertVisit(item: PendingVisit, userId: string) {
  return supabase
    .from("visits")
    .insert({
      family_circle_id: item.familyCircleId,
      person_id: item.personId,
      user_id: userId,
      visited_at: item.visitedAt,
      local_day: item.localDay,
      source: item.source,
      client_token: item.clientToken,
      activities: item.activities ?? [],
      activity_note: item.activityNote ?? null,
    })
    .select("id")
    .maybeSingle();
}


/**
 * Register a visit. Never throws — the result tells the caller what happened
 * so it can show the right message.
 */
export async function recordVisit(input: RecordVisitInput): Promise<RecordVisitResult> {
  const item = buildPending(input);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(item);
    return { status: "queued", reason: "offline", clientToken: item.clientToken };
  }

  const { data: inserted, error } = await insertVisit(item, input.userId);

  if (error) {
    // 23505 = the same visit already reached the server; safe to drop.
    if (error.code === "23505") return { status: "duplicate", clientToken: item.clientToken };
    enqueue(item);
    return { status: "queued", reason: "error", clientToken: item.clientToken };
  }

  return { status: "saved", visitId: inserted?.id ?? null, clientToken: item.clientToken };
}

/** Undo a just-saved visit. */
export async function deleteVisit(visitId: string) {
  await supabase.from("visits").delete().eq("id", visitId);
}

/**
 * Replay everything the offline queue is still holding.
 * Returns how many items were in the queue, so the caller knows whether the
 * UI needs a refresh.
 */
export async function flushPendingVisits(userId: string): Promise<number> {
  const items = getPending();
  for (const item of items) {
    const { error } = await insertVisit(item, userId);
    if (!error || error.code === "23505") dequeue(item.clientToken);
  }
  return items.length;
}
