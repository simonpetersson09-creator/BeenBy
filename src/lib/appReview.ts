/**
 * Apple's native 1-5 star rating prompt.
 *
 * We never store a rating ourselves — iOS shows its own star sheet and Apple
 * decides whether it is actually displayed (max 3 times per year per user).
 *
 * Trigger rule: after the user has registered a few visits, asked once.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

const PLUGIN_NAME = "BeenbyAppReview";

interface BeenbyAppReviewPlugin {
  requestReview(): Promise<{ requested: boolean }>;
}

const BeenbyAppReview = registerPlugin<BeenbyAppReviewPlugin>(PLUGIN_NAME);

const COUNT_KEY = "beenby.review.visitCount";
const ASKED_KEY = "beenby.review.asked";
/** Number of registered visits before we ask. */
const VISITS_BEFORE_ASK = 3;

function available(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "ios" &&
      Capacitor.isPluginAvailable(PLUGIN_NAME)
    );
  } catch {
    return false;
  }
}

/**
 * Call after a visit has been successfully saved. Silently does nothing on the
 * web, before the threshold, or once the prompt has been shown.
 */
export async function maybeAskForReview(): Promise<void> {
  if (!available()) return;
  try {
    if (localStorage.getItem(ASKED_KEY) === "1") return;
    const count = Number(localStorage.getItem(COUNT_KEY) ?? "0") + 1;
    localStorage.setItem(COUNT_KEY, String(count));
    if (count < VISITS_BEFORE_ASK) return;
    localStorage.setItem(ASKED_KEY, "1");
    // Let the success toast settle before Apple's sheet appears.
    setTimeout(() => {
      void BeenbyAppReview.requestReview().catch(() => {});
    }, 1500);
  } catch {
    // Storage blocked — never break the visit flow over a rating prompt.
  }
}
