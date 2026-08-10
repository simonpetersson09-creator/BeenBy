/**
 * THE single source of truth for Premium AND trial access in the whole app.
 *
 * - On native iOS `isPremium` always comes from StoreKit 2 (verified entitlements).
 * - Everywhere else it is permanently false; no localStorage flag, no override.
 * - The 30 day free trial is based on `profiles.trial_started_at`, a server
 *   timestamp written once by a database trigger the first time the user joins
 *   or creates a family circle. It can never be reset from the client.
 * - hasAccess = isPremium || isTrialActive
 *
 * UI must read this through `usePremium()` / `useAccess()`.
 */
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getSubscriptionStatus,
  getPremiumPrice,
  purchasePremium as purchasePremiumApi,
  restorePurchases as restorePurchasesApi,
  openSubscriptionManagement,
  PREMIUM_PRODUCT_ID,
} from "@/lib/premium";
import type { PurchaseResult, RestoreResult, SubscriptionStatus } from "@/lib/storekit";
import { isStoreKitAvailable } from "@/lib/storekit";

/** Length of the free period, in days. */
export const TRIAL_DAYS = 30;

export type PremiumState = {
  isPremium: boolean;
  loading: boolean;
  /** true once a real check has completed at least once */
  checked: boolean;
  productId?: string;
  /** Localised price string from StoreKit, when available. */
  priceLabel?: string;
  expiresAt?: string;
  source: SubscriptionStatus["source"];

  /** Server timestamp (ISO) for when this user's free period started. */
  trialStartedAt?: string;
  /** ISO timestamp for when the free period ends. */
  trialEndsAt?: string;
  /** Whole days left of the free period (0 when it has ended). */
  trialDaysLeft: number;
  isTrialActive: boolean;
  /** true once the trial has been looked up at least once */
  trialChecked: boolean;
  /** Premium OR an active trial. */
  hasAccess: boolean;
};

const initial: PremiumState = {
  isPremium: false,
  loading: false,
  checked: false,
  source: "fallback",
  trialDaysLeft: 0,
  isTrialActive: false,
  trialChecked: false,
  hasAccess: false,
};

let state: PremiumState = initial;

const listeners = new Set<() => void>();

function derive(next: PremiumState): PremiumState {
  let trialEndsAt: string | undefined;
  let trialDaysLeft = 0;
  let isTrialActive = false;

  if (next.trialStartedAt) {
    const start = new Date(next.trialStartedAt).getTime();
    if (!Number.isNaN(start)) {
      const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
      trialEndsAt = new Date(end).toISOString();
      const msLeft = end - Date.now();
      isTrialActive = msLeft > 0;
      trialDaysLeft = isTrialActive ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0;
    }
  } else if (!next.trialChecked) {
    // Unknown yet — don't lock anything before we know.
    isTrialActive = true;
  }

  return {
    ...next,
    ...(trialEndsAt ? { trialEndsAt } : {}),
    trialDaysLeft,
    isTrialActive,
    hasAccess: next.isPremium || isTrialActive,
  };
}

function setState(patch: Partial<PremiumState>) {
  state = derive({ ...state, ...patch });
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
    const priceLabel = await getPremiumPrice();
    setState({
      isPremium: status.isPremium,
      ...(status.productId ? { productId: status.productId } : {}),
      ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
      ...(priceLabel ? { priceLabel } : {}),
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

let trialInFlight: Promise<PremiumState> | null = null;

/**
 * Read the server-stored trial start for the signed-in user.
 * Never writes anything — the timestamp is created by a database trigger the
 * first time the user becomes a member of a family circle.
 */
export async function refreshTrialStatus(): Promise<PremiumState> {
  if (trialInFlight) return trialInFlight;
  trialInFlight = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return state;

    const { data, error } = await supabase
      .from("profiles")
      .select("trial_started_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[premium] trial lookup failed", error);
      return state;
    }

    setState({
      ...(data?.trial_started_at ? { trialStartedAt: data.trial_started_at } : {}),
      trialChecked: true,
    });
    return state;
  })();
  try {
    return await trialInFlight;
  } finally {
    trialInFlight = null;
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
 * Called once from the app shell. Checks Premium + trial at startup and again
 * every time the app becomes active again.
 */
export function startPremiumLifecycle(): () => void {
  if (typeof window === "undefined") return () => {};
  if (lifecycleStarted) return () => {};
  lifecycleStarted = true;

  const refreshAll = () => {
    void refreshPremiumStatus();
    void refreshTrialStatus();
  };

  refreshAll();

  const onVisible = () => {
    if (document.visibilityState === "visible") refreshAll();
  };
  document.addEventListener("visibilitychange", onVisible);

  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      void refreshTrialStatus();
    }
  });

  let removeNative: (() => void) | undefined;
  if (isStoreKitAvailable()) {
    void import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) refreshAll();
        }),
      )
      .then((handle) => {
        removeNative = () => void handle.remove();
      })
      .catch((error) => console.warn("[premium] app lifecycle listener unavailable", error));
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    authSub.subscription.unsubscribe();
    removeNative?.();
    lifecycleStarted = false;
  };
}

/** Read the shared, verified Premium + trial state. */
export function usePremium(): PremiumState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Convenience alias for feature gating. */
export function useAccess(): PremiumState {
  return usePremium();
}

export { PREMIUM_PRODUCT_ID };
