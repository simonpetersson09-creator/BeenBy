/**
 * The only Premium API the UI is allowed to call.
 *
 * On native iOS these delegate to the BeenbyStoreKit Capacitor plugin
 * (StoreKit 2, implemented later in the iOS project). Everywhere else —
 * browser, Lovable preview, Android — they return a safe fallback so the
 * app never crashes and never grants Premium without App Store verification.
 */
import {
  BeenbyStoreKit,
  isNativeIOS,
  isStoreKitAvailable,
  type PurchaseResult,
  type RestoreResult,
  type SubscriptionStatus,
} from "@/lib/storekit";

export type { PurchaseResult, RestoreResult, SubscriptionStatus };
export { isNativeIOS };

/** Product identifier for the Premium subscription in App Store Connect. */
export const PREMIUM_PRODUCT_ID = "com.beenbys.premium.monthly";

const WEB_NOTICE = "[premium] Native StoreKit is only available in the iOS app.";

/**
 * FALLBACK — not a real App Store verification.
 * Used when the native plugin is missing (web, preview, plugin not built yet).
 */
const FALLBACK_STATUS: SubscriptionStatus = { isPremium: false, source: "fallback" };

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (!isStoreKitAvailable()) {
    console.info(WEB_NOTICE, "getSubscriptionStatus -> fallback isPremium:false");
    return FALLBACK_STATUS;
  }
  try {
    const status = await BeenbyStoreKit.getSubscriptionStatus();
    return { source: "storekit", ...status };
  } catch (error) {
    console.error("[premium] getSubscriptionStatus failed", error);
    return FALLBACK_STATUS;
  }
}

export async function purchasePremium(
  productId: string = PREMIUM_PRODUCT_ID,
): Promise<PurchaseResult> {
  if (!isStoreKitAvailable()) {
    console.info(WEB_NOTICE, "purchasePremium -> unavailable");
    // No simulated purchase: the web build can never activate Premium.
    return { outcome: "pending", message: "unavailable-on-web" };
  }
  try {
    const result = await BeenbyStoreKit.purchasePremium({ productId });
    return result;
  } catch (error) {
    console.error("[premium] purchasePremium failed", error);
    return { outcome: "error", message: String(error) };
  }
}

export async function restorePurchases(): Promise<RestoreResult> {
  if (!isStoreKitAvailable()) {
    console.info(WEB_NOTICE, "restorePurchases -> unavailable");
    return { restored: false, message: "unavailable-on-web" };
  }
  try {
    return await BeenbyStoreKit.restorePurchases();
  } catch (error) {
    console.error("[premium] restorePurchases failed", error);
    return { restored: false, message: String(error) };
  }
}

export async function openSubscriptionManagement(): Promise<boolean> {
  if (!isStoreKitAvailable()) {
    console.info(WEB_NOTICE, "openSubscriptionManagement -> unavailable");
    return false;
  }
  try {
    await BeenbyStoreKit.manageSubscription();
    return true;
  } catch (error) {
    console.error("[premium] manageSubscription failed", error);
    return false;
  }
}
