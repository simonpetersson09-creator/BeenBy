/**
 * TypeScript bridge to the native Android BeenbyPlayBilling plugin
 * (Google Play Billing). Apple's StoreKit bridge lives in ./storekit.ts and is
 * completely separate — only one of them is ever available on a device.
 *
 * NOTHING here grants Premium: Google's purchaseToken is handed to the server,
 * which verifies it with the Play Developer API.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export const PLAY_BILLING_PLUGIN_NAME = "BeenbyPlayBilling";

export interface BeenbyPlayBillingPlugin {
  getSubscriptionStatus(options?: { productId?: string }): Promise<{
    isPremium: boolean;
    productId?: string;
    purchaseToken?: string;
  }>;
  purchasePremium(options?: { productId?: string; appAccountToken?: string }): Promise<{
    outcome: "success" | "cancelled" | "pending" | "error";
    productId?: string;
    purchaseToken?: string;
    message?: string;
  }>;
  restorePurchases(options?: { productId?: string }): Promise<{
    restored: boolean;
    purchaseToken?: string;
    message?: string;
  }>;
  manageSubscription(options?: { productId?: string }): Promise<void>;
  getProductInfo(options?: { productId?: string }): Promise<{
    productId: string;
    displayPrice?: string;
    title?: string;
  }>;
  getDeviceAnchor(): Promise<{ anchor?: string }>;
}

export const BeenbyPlayBilling = registerPlugin<BeenbyPlayBillingPlugin>(PLAY_BILLING_PLUGIN_NAME);

/** True when running inside the native Android shell (Capacitor). */
export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/** True when the Google Play Billing plugin is registered on this device. */
export function isPlayBillingAvailable(): boolean {
  try {
    return isNativeAndroid() && Capacitor.isPluginAvailable(PLAY_BILLING_PLUGIN_NAME);
  } catch {
    return false;
  }
}
