/**
 * Step 5: turn a native "Ja" answer on the geofence arrival notification into
 * a real BeenBy visit.
 *
 * The native plugin persists every "Ja" as a pending confirmation. This module
 * is the ONLY place that consumes them, and it deliberately owns no insert
 * logic of its own — the visit is always written through `recordVisit()` in
 * src/lib/visits.ts (same client_token / offline queue / 23505 protection as
 * the "Jag är här" button).
 *
 * Runs on app start, on resume, and on the `geofenceConfirmed` event. The
 * pending confirmation is the single source of truth, so the same "Ja" can
 * never produce two visits regardless of which trigger fires first.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingGeofenceConfirmation,
  getPendingGeofenceConfirmations,
  type PendingGeofenceConfirmation,
} from "@/lib/geofence";
import { refreshPremiumStatus, refreshTrialStatus } from "@/lib/premiumStore";
import { recordVisit } from "@/lib/visits";

export type ProcessResult = {
  /** How many pending confirmations were looked at. */
  seen: number;
  /** How many resulted in a visit being saved, deduped or safely queued. */
  recorded: number;
  /** How many were dropped without a visit (no access / stale circle). */
  discarded: number;
  /** How many were kept for a later attempt (no session / unexpected error). */
  kept: number;
};

const emptyResult: ProcessResult = { seen: 0, recorded: 0, discarded: 0, kept: 0 };

/** Guards against two overlapping runs (event + resume at the same moment). */
let running: Promise<ProcessResult> | null = null;

/**
 * Verifies, against the backend, that the user is still a member of the circle
 * and that the person really belongs to that circle. Metadata from the
 * notification is never trusted on its own.
 */
async function verifyCircleAndPerson(
  userId: string,
  familyCircleId: string,
  personId: string,
): Promise<{ ok: boolean; timezone?: string }> {
  const { data: membership, error: mErr } = await supabase
    .from("family_members")
    .select("family_circle_id")
    .eq("family_circle_id", familyCircleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) return { ok: false };
  if (!membership) return { ok: false };

  const { data: person, error: pErr } = await supabase
    .from("persons")
    .select("id")
    .eq("id", personId)
    .eq("family_circle_id", familyCircleId)
    .maybeSingle();
  if (pErr) return { ok: false };
  if (!person) return { ok: false };

  const { data: circle } = await supabase
    .from("family_circles")
    .select("timezone")
    .eq("id", familyCircleId)
    .maybeSingle();

  return { ok: true, timezone: circle?.timezone ?? "Europe/Stockholm" };
}

async function processOne(
  confirmation: PendingGeofenceConfirmation,
  userId: string,
  hasAccess: boolean,
): Promise<"recorded" | "discarded" | "kept"> {
  // Expired trial without Premium: no visit, but drop the answer so it does
  // not retry forever. The paywall is never opened from this background path.
  if (!hasAccess) {
    await clearPendingGeofenceConfirmation(confirmation.id);
    return "discarded";
  }

  const check = await verifyCircleAndPerson(userId, confirmation.familyCircleId, confirmation.personId);
  if (!check.ok) {
    // The user left the circle or the person is gone — nothing to record.
    await clearPendingGeofenceConfirmation(confirmation.id);
    return "discarded";
  }

  const result = await recordVisit({
    familyCircleId: confirmation.familyCircleId,
    personId: confirmation.personId,
    userId,
    timezone: check.timezone!,
    source: "geofence",
    // The visit belongs to the moment the user tapped "Ja", not to whenever
    // the app happened to be opened afterwards.
    visitedAt: confirmation.respondedAt,
  });

  // saved / duplicate → done. queued → the visit is safely in the existing
  // offline queue (localStorage) and flushPendingVisits() will replay it, so
  // the confirmation has been fully handed over and can be cleared.
  if (result.status === "saved" || result.status === "duplicate" || result.status === "queued") {
    await clearPendingGeofenceConfirmation(confirmation.id);
    return "recorded";
  }

  return "kept";
}

/**
 * Reads every pending "Ja", records the corresponding visits and clears the
 * ones that have been handled. Never throws.
 */
export async function processPendingGeofenceConfirmations(): Promise<ProcessResult> {
  if (running) return running;

  running = (async (): Promise<ProcessResult> => {
    try {
      const confirmations = await getPendingGeofenceConfirmations();
      if (confirmations.length === 0) return emptyResult;

      // No valid session → keep everything for the next app start.
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        return { seen: confirmations.length, recorded: 0, discarded: 0, kept: confirmations.length };
      }

      // Access is decided by the existing store (StoreKit + server trial RPC).
      await refreshPremiumStatus();
      const state = await refreshTrialStatus();
      const hasAccess = state.hasAccess;

      const result: ProcessResult = { seen: confirmations.length, recorded: 0, discarded: 0, kept: 0 };
      for (const confirmation of confirmations) {
        try {
          const outcome = await processOne(confirmation, userId, hasAccess);
          result[outcome === "recorded" ? "recorded" : outcome === "discarded" ? "discarded" : "kept"] += 1;
        } catch {
          // Unexpected failure: keep the confirmation, try again next time.
          result.kept += 1;
        }
      }
      return result;
    } catch {
      return emptyResult;
    } finally {
      running = null;
    }
  })();

  return running;
}
