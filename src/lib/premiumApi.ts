/**
 * Premium calls that work in BOTH build targets.
 *
 * - Web/SSR: the TanStack server function (same origin, bearer attached by the
 *   registered function middleware).
 * - Capacitor/iOS: an authenticated HTTPS call to the published backend.
 *
 * Both paths end up in the exact same server code (`src/lib/premium.server.ts`)
 * and the same `premium_entitlements` row.
 */
import type { EntitlementState } from "@/lib/premium.server";
import { callNativeApi } from "@/lib/nativeApi";
import { IS_NATIVE_SPA } from "@/lib/runtime";

export type { EntitlementState };

export async function fetchEntitlement(): Promise<EntitlementState> {
  if (IS_NATIVE_SPA) {
    return callNativeApi<EntitlementState>("premium", { action: "entitlement" });
  }
  const { getEntitlement } = await import("@/lib/premium.functions");
  return getEntitlement();
}

export async function sendTransaction(jws: string): Promise<EntitlementState> {
  if (IS_NATIVE_SPA) {
    return callNativeApi<EntitlementState>("premium", { action: "submit", jws });
  }
  const { submitTransaction } = await import("@/lib/premium.functions");
  return submitTransaction({ data: { jws } });
}

export async function sendTrialAnchor(anchor: string): Promise<unknown> {
  if (IS_NATIVE_SPA) {
    return callNativeApi("premium", { action: "anchor", anchor });
  }
  const { claimTrialAnchor } = await import("@/lib/premium.functions");
  return claimTrialAnchor({ data: { anchor } });
}
