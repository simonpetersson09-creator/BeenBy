/**
 * Server-side Premium. The device may send Apple's signed transaction, but the
 * decision — and the row in `premium_entitlements` — is always made here.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EntitlementState = {
  isPremium: boolean;
  productId?: string;
  expiresAt?: string;
  environment?: string;
  error?: string;
};

/**
 * Reads the server's verdict for the signed-in user. This is the value the UI
 * must trust; StoreKit on the device is only an input signal.
 */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementState> => {
    const { data } = await context.supabase
      .from("premium_entitlements")
      .select("is_active, product_id, expires_at, revoked_at, platform")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data) return { isPremium: false };
    const active =
      data.is_active === true &&
      !data.revoked_at &&
      (!data.expires_at || Date.parse(data.expires_at) > Date.now());
    return {
      isPremium: active,
      ...(data.product_id ? { productId: data.product_id } : {}),
      ...(data.expires_at ? { expiresAt: data.expires_at } : {}),
    };
  });

/**
 * Takes the JWS StoreKit handed to the app, verifies it against Apple's pinned
 * certificate chain and stores the result for this user.
 */
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
    const { verifyTransaction, grantsPremium, toIso } = await import("@/lib/appstore.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let tx;
    try {
      tx = await verifyTransaction(data.jws);
    } catch (error) {
      return { isPremium: false, error: `unverified: ${(error as Error).message}` };
    }

    const originalTransactionId = tx.originalTransactionId ?? tx.transactionId ?? null;
    if (!originalTransactionId) return { isPremium: false, error: "missing transaction id" };

    // A subscription belongs to exactly one BeenBy account. If it is already
    // linked elsewhere we refuse instead of silently moving it.
    const { data: existing } = await supabaseAdmin
      .from("premium_entitlements")
      .select("user_id")
      .eq("original_transaction_id", originalTransactionId)
      .maybeSingle();
    if (existing && existing.user_id !== context.userId) {
      return { isPremium: false, error: "already-linked" };
    }

    const active = grantsPremium(tx);
    const { error } = await supabaseAdmin.from("premium_entitlements").upsert(
      {
        user_id: context.userId,
        is_active: active,
        platform: "ios",
        product_id: tx.productId ?? null,
        expires_at: toIso(tx.expiresDate),
        revoked_at: toIso(tx.revocationDate),
        original_transaction_id: originalTransactionId,
        transaction_id: tx.transactionId ?? null,
        environment: tx.environment ?? null,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return { isPremium: false, error: error.message };

    return {
      isPremium: active,
      ...(tx.productId ? { productId: tx.productId } : {}),
      ...(toIso(tx.expiresDate) ? { expiresAt: toIso(tx.expiresDate)! } : {}),
      ...(tx.environment ? { environment: tx.environment } : {}),
    };
  });

/**
 * Binds the free period to a Keychain-backed device anchor so that signing out,
 * "start over" or a reinstall cannot hand out a brand new 30 day trial.
 */
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
    const { data: rows, error } = await context.supabase.rpc("claim_trial_anchor", {
      _anchor: data.anchor,
    });
    if (error) return { ok: false as const, error: error.message };
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { ok: true as const, status: row ?? null };
  });
