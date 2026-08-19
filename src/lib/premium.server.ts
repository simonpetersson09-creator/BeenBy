/**
 * Server-only Premium logic. Shared by the TanStack server functions (web) and
 * the HTTPS endpoints the native iOS app calls (`/api/public/native/premium`),
 * so both paths make exactly the same decision and write the same row.
 *
 * The user id is ALWAYS supplied by the caller after it has been derived from a
 * verified Supabase JWT — never from a request body.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { EntitlementState } from "@/lib/premiumTypes";

export type { EntitlementState };

type UserClient = SupabaseClient<Database>;

/** The server's verdict for this user, straight from `premium_entitlements`. */
export async function readEntitlement(
  supabase: UserClient,
  userId: string,
): Promise<EntitlementState> {
  const { data } = await supabase
    .from("premium_entitlements")
    .select("is_active, product_id, expires_at, revoked_at, platform")
    .eq("user_id", userId)
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
}

/**
 * Verifies Apple's signed transaction (JWS) against the pinned Apple Root CA
 * chain and stores the outcome. The device can only ever hand us Apple's own
 * signature; it can never assert Premium by itself.
 */
export async function applyTransaction(userId: string, jws: string): Promise<EntitlementState> {
  const { verifyTransaction, grantsPremium, toIso } = await import("@/lib/appstore.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let tx;
  try {
    tx = await verifyTransaction(jws);
  } catch (error) {
    // Never log the JWS itself.
    console.warn("[premium] transaction verification failed:", (error as Error).message);
    return { isPremium: false, error: "unverified" };
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
  if (existing && existing.user_id !== userId) {
    return { isPremium: false, error: "already-linked" };
  }

  const active = grantsPremium(tx);
  const { error } = await supabaseAdmin.from("premium_entitlements").upsert(
    {
      user_id: userId,
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
}

/** Binds the free period to a Keychain-backed device anchor. */
export async function claimAnchor(supabase: UserClient, anchor: string) {
  const { data: rows, error } = await supabase.rpc("claim_trial_anchor", { _anchor: anchor });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { ok: true as const, status: row ?? null };
}
