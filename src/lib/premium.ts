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
    return { ...status, source: "storekit" };
  } catch (error) {
    console.error("[premium] getSubscriptionStatus failed", error);
    return FALLBACK_STATUS;
  }
}

export async function purchasePremium(
  productId: string = PREMIUM_PRODUCT_ID,
  appAccountToken?: string,
): Promise<PurchaseResult> {
  if (!isStoreKitAvailable()) {
    console.info(WEB_NOTICE, "purchasePremium -> unavailable");
    // No simulated purchase: the web build can never activate Premium.
    return { outcome: "pending", message: "unavailable-on-web" };
  }
  try {
    const result = await BeenbyStoreKit.purchasePremium({
      productId,
      ...(appAccountToken ? { appAccountToken } : {}),
    });
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

/**
 * Localised price string straight from StoreKit (e.g. "19,00 kr").
 * Never hard-coded: returns undefined when StoreKit isn't available, and the
 * paywall then simply shows no price.
 */
export async function getPremiumPrice(
  productId: string = PREMIUM_PRODUCT_ID,
): Promise<string | undefined> {
  if (!isStoreKitAvailable()) return undefined;
  try {
    const info = await BeenbyStoreKit.getProductInfo?.({ productId });
    return info?.displayPrice;
  } catch (error) {
    console.warn("[premium] getProductInfo unavailable", error);
    return undefined;
  }
}

const ANCHOR_FALLBACK_KEY = "beenby.trial.anchor";

/**
 * Fallback anchor for native builds whose plugin predates `getDeviceAnchor`.
 * Weaker than the Keychain (a reinstall clears it) but it still stops
 * "start over" / sign-out from handing out another 30 days.
 */
function fallbackAnchor(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.localStorage.getItem(ANCHOR_FALLBACK_KEY);
    if (existing && existing.length >= 8) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(ANCHOR_FALLBACK_KEY, created);
    return created;
  } catch {
    return undefined;
  }
}

/**
 * Keychain-backed device anchor. It survives sign-out, "start over" and a
 * reinstall, which is what stops the 30 day trial from being restarted.
 * Returns undefined outside the native app — then no anchor is claimed.
 */
export async function getDeviceAnchor(): Promise<string | undefined> {
  if (!isNativeIOS()) return undefined;
  try {
    const result = await BeenbyStoreKit.getDeviceAnchor?.();
    if (result?.anchor) return result.anchor;
  } catch (error) {
    console.warn("[premium] getDeviceAnchor unavailable", error);
  }
  return fallbackAnchor();
}
