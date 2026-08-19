/**
 * TypeScript bridge to the (not yet implemented) native iOS StoreKit 2 plugin.
 *
 * The Swift side lives in the iOS project and is added later. This file only
 * declares the contract and registers the plugin with Capacitor so that
 * `npx cap sync ios` picks it up once the native implementation exists.
 *
 * NOTHING here performs a real purchase, and there is no web fallback that
 * could ever grant Premium.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

/** Plugin name that the Swift implementation must register as. */
export const STOREKIT_PLUGIN_NAME = "BeenbyStoreKit";

export type SubscriptionStatus = {
  /** True only when App Store verification says the subscription is active. */
  isPremium: boolean;
  productId?: string;
  expiresAt?: string;
  /** Apple's signed transaction, handed to the server for verification. */
  jws?: string;
  /** Where the answer came from — "fallback" is NOT a real verification. */
  source: "storekit" | "fallback";
};

export type PurchaseResult = {
  outcome: "success" | "cancelled" | "pending" | "error";
  productId?: string;
  message?: string;
  /** Apple's signed transaction for the completed purchase. */
  jws?: string;
};

export type RestoreResult = {
  restored: boolean;
  message?: string;
  jws?: string;
};

export type ProductInfo = {
  productId: string;
  /** Localised price from StoreKit, e.g. "19,00 kr". */
  displayPrice?: string;
  title?: string;
};

export interface BeenbyStoreKitPlugin {
  getSubscriptionStatus(): Promise<SubscriptionStatus>;
  purchasePremium(options?: {
    productId?: string;
    /** BeenBy user id, echoed back by Apple in server notifications. */
    appAccountToken?: string;
  }): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  manageSubscription(): Promise<void>;
  /** Optional: older builds of the native plugin may not implement this. */
  getProductInfo?(options?: { productId?: string }): Promise<ProductInfo>;
  /** Keychain-backed device id used to anchor the free trial. */
  getDeviceAnchor?(): Promise<{ anchor?: string }>;
}

export const BeenbyStoreKit = registerPlugin<BeenbyStoreKitPlugin>(STOREKIT_PLUGIN_NAME);

/** True when running inside the native iOS shell (Capacitor). */
export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** True when the native plugin is actually registered on this device. */
export function isStoreKitAvailable(): boolean {
  try {
    return isNativeIOS() && Capacitor.isPluginAvailable(STOREKIT_PLUGIN_NAME);
  } catch {
    return false;
  }
}
