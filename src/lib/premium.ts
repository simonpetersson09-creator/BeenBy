/**
 * The only Premium API the UI is allowed to call.
 *
 * - Native iOS: delegates to the BeenbyStoreKit plugin (Apple StoreKit 2).
 * - Native Android: delegates to the BeenbyPlayBilling plugin (Google Play Billing).
 * - Everywhere else (browser, Lovable preview): a safe fallback, so the app
 *   never crashes and never grants Premium without store verification.
 *
 * The two store implementations are fully separate modules; this file only
 * picks one. Whatever the store returns is verified by the server.
 */
import {
  BeenbyStoreKit,
  isNativeIOS,
  isStoreKitAvailable,
  type PurchaseResult,
  type RestoreResult,
  type SubscriptionStatus,
} from "@/lib/storekit";
import { BeenbyPlayBilling, isNativeAndroid, isPlayBillingAvailable } from "@/lib/playBilling";

export type { PurchaseResult, RestoreResult, SubscriptionStatus };
export { isNativeIOS, isNativeAndroid };

/** Product identifier for the Premium subscription (same id in App Store Connect and Google Play Console). */
export const PREMIUM_PRODUCT_ID = "com.beenbys.premium.monthly";

const WEB_NOTICE = "[premium] Native store billing is only available in the iOS/Android app.";

/** True when a real store (Apple or Google) is reachable on this device. */
export function isStoreAvailable(): boolean {
  return isStoreKitAvailable() || isPlayBillingAvailable();
}

/**
 * FALLBACK — not a real store verification.
 * Used when no native plugin is present (web, preview, plugin not built yet).
 */
const FALLBACK_STATUS: SubscriptionStatus = { isPremium: false, source: "fallback" };

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (isStoreKitAvailable()) {
    try {
      const status = await BeenbyStoreKit.getSubscriptionStatus();
      return { ...status, source: "storekit" };
    } catch (error) {
      console.error("[premium] getSubscriptionStatus failed", error);
      return FALLBACK_STATUS;
    }
  }
  if (isPlayBillingAvailable()) {
    try {
      const status = await BeenbyPlayBilling.getSubscriptionStatus({ productId: PREMIUM_PRODUCT_ID });
      return {
        isPremium: status.isPremium,
        ...(status.productId ? { productId: status.productId } : {}),
        ...(status.purchaseToken ? { purchaseToken: status.purchaseToken } : {}),
        source: "playbilling",
      };
    } catch (error) {
      console.error("[premium] play getSubscriptionStatus failed", error);
      return FALLBACK_STATUS;
    }
  }
  console.info(WEB_NOTICE, "getSubscriptionStatus -> fallback isPremium:false");
  return FALLBACK_STATUS;
}

export async function purchasePremium(
  productId: string = PREMIUM_PRODUCT_ID,
  appAccountToken?: string,
): Promise<PurchaseResult> {
  if (isStoreKitAvailable()) {
    try {
      return await BeenbyStoreKit.purchasePremium({
        productId,
        ...(appAccountToken ? { appAccountToken } : {}),
      });
    } catch (error) {
      console.error("[premium] purchasePremium failed", error);
      return { outcome: "error", message: String(error) };
    }
  }
  if (isPlayBillingAvailable()) {
    try {
      return await BeenbyPlayBilling.purchasePremium({
        productId,
        ...(appAccountToken ? { appAccountToken } : {}),
      });
    } catch (error) {
      console.error("[premium] play purchasePremium failed", error);
      return { outcome: "error", message: String(error) };
    }
  }
  console.info(WEB_NOTICE, "purchasePremium -> unavailable");
  // No simulated purchase: the web build can never activate Premium.
  return { outcome: "pending", message: "unavailable-on-web" };
}

export async function restorePurchases(): Promise<RestoreResult> {
  if (isStoreKitAvailable()) {
    try {
      const result = await BeenbyStoreKit.restorePurchases();
      return {
        ...result,
        outcome:
          result.outcome ?? (result.restored ? "restored" : result.message ? "sync_failed" : "not_found"),
        source: "storekit",
      };
    } catch (error) {
      console.error("[premium] restorePurchases failed", error);
      return { outcome: "sync_failed", restored: false, message: String(error), source: "storekit" };
    }
  }
  if (isPlayBillingAvailable()) {
    try {
      const result = await BeenbyPlayBilling.restorePurchases({ productId: PREMIUM_PRODUCT_ID });
      return {
        ...result,
        outcome: result.restored ? "restored" : "not_found",
        source: "playbilling",
      };
    } catch (error) {
      console.error("[premium] play restorePurchases failed", error);
      return { outcome: "sync_failed", restored: false, message: String(error), source: "playbilling" };
    }
  }
  console.info(WEB_NOTICE, "restorePurchases -> unavailable");
  return { outcome: "sync_failed", restored: false, message: "unavailable-on-web", source: "fallback" };
}

export async function openSubscriptionManagement(): Promise<boolean> {
  try {
    if (isStoreKitAvailable()) {
      await BeenbyStoreKit.manageSubscription();
      return true;
    }
    if (isPlayBillingAvailable()) {
      await BeenbyPlayBilling.manageSubscription({ productId: PREMIUM_PRODUCT_ID });
      return true;
    }
  } catch (error) {
    console.error("[premium] manageSubscription failed", error);
    return false;
  }
  console.info(WEB_NOTICE, "openSubscriptionManagement -> unavailable");
  return false;
}

/**
 * Localised price string straight from the store (e.g. "19,00 kr").
 * Never hard-coded: returns undefined when no store is available.
 */
export async function getPremiumPrice(
  productId: string = PREMIUM_PRODUCT_ID,
): Promise<string | undefined> {
  try {
    if (isStoreKitAvailable()) {
      const info = await BeenbyStoreKit.getProductInfo?.({ productId });
      return info?.displayPrice;
    }
    if (isPlayBillingAvailable()) {
      const info = await BeenbyPlayBilling.getProductInfo({ productId });
      return info?.displayPrice;
    }
  } catch (error) {
    console.warn("[premium] getProductInfo unavailable", error);
  }
  return undefined;
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
 * Device anchor that survives sign-out, "start over" and a reinstall, which
 * is what stops the 30 day trial from being restarted.
 * iOS: Keychain. Android: hashed ANDROID_ID. Web: undefined (no anchor).
 */
export async function getDeviceAnchor(): Promise<string | undefined> {
  if (isNativeIOS()) {
    try {
      const result = await BeenbyStoreKit.getDeviceAnchor?.();
      if (result?.anchor) return result.anchor;
    } catch (error) {
      console.warn("[premium] getDeviceAnchor unavailable", error);
    }
    return fallbackAnchor();
  }
  if (isNativeAndroid()) {
    try {
      if (isPlayBillingAvailable()) {
        const result = await BeenbyPlayBilling.getDeviceAnchor();
        if (result?.anchor) return result.anchor;
      }
    } catch (error) {
      console.warn("[premium] android getDeviceAnchor unavailable", error);
    }
    return fallbackAnchor();
  }
  return undefined;
}
