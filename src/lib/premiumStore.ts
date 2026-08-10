/**
 * THE single source of truth for Premium in the whole app.
 *
 * - On native iOS the value always comes from StoreKit 2 (verified entitlements).
 * - Everywhere else it is permanently false; no localStorage flag, no override.
 * - Refreshed on app start and every time the app returns to foreground.
 *
 * UI must read this through `usePremium()` — never call getSubscriptionStatus()
 * directly for rendering state.
 */
import { useSyncExternalStore } from "react";

import {
  getSubscriptionStatus,
  purchasePremium as purchasePremiumApi,
  restorePurchases as restorePurchasesApi,
  openSubscriptionManagement,
  PREMIUM_PRODUCT_ID,
} from "@/lib/premium";
import type { PurchaseResult, RestoreResult, SubscriptionStatus } from "@/lib/storekit";
import { isStoreKitAvailable } from "@/lib/storekit";

export type PremiumState = {
  isPremium: boolean;
  loading: boolean;
  /** true once a real check has completed at least once */
  checked: boolean;
  productId?: string;
  expiresAt?: string;
  source: SubscriptionStatus["source"];
};

let state: PremiumState = {
  isPremium: false,
  loading: false,
  checked: false,
  source: "fallback",
};

const listeners = new Set<() => void>();

function setState(patch: Partial<PremiumState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

let inFlight: Promise<PremiumState> | null = null;

/** Ask StoreKit for the verified status and publish it to every subscriber. */
export async function refreshPremiumStatus(): Promise<PremiumState> {
  if (inFlight) return inFlight;
  setState({ loading: true });
  inFlight = (async () => {
    const status = await getSubscriptionStatus();
    setState({
      isPremium: status.isPremium,
      ...(status.productId ? { productId: status.productId } : {}),
      ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
      source: status.source,
      loading: false,
      checked: true,
    });
    return state;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function purchasePremium(): Promise<PurchaseResult> {
  const result = await purchasePremiumApi(PREMIUM_PRODUCT_ID);
  // Always re-verify with StoreKit — never trust the purchase result alone.
  await refreshPremiumStatus();
  return result;
}

export async function restorePurchases(): Promise<RestoreResult> {
  const result = await restorePurchasesApi();
  await refreshPremiumStatus();
  return result;
}

export async function manageSubscription(): Promise<boolean> {
  const opened = await openSubscriptionManagement();
  if (opened) await refreshPremiumStatus();
  return opened;
}

let lifecycleStarted = false;

/**
 * Called once from the app shell. Checks Premium at startup and again every
 * time the app becomes active again (subscription may have changed in the
 * App Store settings while the app was in the background).
 */
export function startPremiumLifecycle(): () => void {
  if (typeof window === "undefined") return () => {};
  if (lifecycleStarted) return () => {};
  lifecycleStarted = true;

  void refreshPremiumStatus();

  const onVisible = () => {
    if (document.visibilityState === "visible") void refreshPremiumStatus();
  };
  document.addEventListener("visibilitychange", onVisible);

  let removeNative: (() => void) | undefined;
  if (isStoreKitAvailable()) {
    void import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void refreshPremiumStatus();
        }),
      )
      .then((handle) => {
        removeNative = () => void handle.remove();
      })
      .catch((error) => console.warn("[premium] app lifecycle listener unavailable", error));
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    removeNative?.();
    lifecycleStarted = false;
  };
}

/** Read the shared, verified Premium state. */
export function usePremium(): PremiumState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { PREMIUM_PRODUCT_ID };
