/**
 * Server-side Premium (web build). Thin wrappers around `premium.server.ts`,
 * which the native iOS HTTPS endpoint uses too — one implementation, one
 * verdict. The device may send Apple's signed transaction, but the decision —
 * and the row in `premium_entitlements` — is always made on the server.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntitlementState } from "@/lib/premiumTypes";

export type { EntitlementState };

/** Reads the server's verdict for the signed-in user. */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementState> => {
    const { readEntitlement } = await import("@/lib/premium.server");
    return readEntitlement(context.supabase, context.userId);
  });

/** Verifies Apple's JWS and stores the result for this user. */
export const submitTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const jws = (data as { jws?: unknown } | null)?.jws;
    if (typeof jws !== "string" || jws.length < 20 || jws.length > 20000) {
      throw new Error("invalid transaction");
    }
    return { jws };
  })
  .handler(async ({ data, context }): Promise<EntitlementState> => {
    const { applyTransaction } = await import("@/lib/premium.server");
    return applyTransaction(context.userId, data.jws);
  });

/** Binds the free period to a Keychain-backed device anchor. */
export const claimTrialAnchor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const anchor = (data as { anchor?: unknown } | null)?.anchor;
    if (typeof anchor !== "string" || anchor.length < 8 || anchor.length > 200) {
      throw new Error("invalid anchor");
    }
    return { anchor };
  })
  .handler(async ({ data, context }) => {
    const { claimAnchor } = await import("@/lib/premium.server");
    return claimAnchor(context.supabase, data.anchor);
  });
