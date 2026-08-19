import { createFileRoute } from "@tanstack/react-router";

/**
 * App Store Server Notifications V2.
 *
 * Apple calls this URL whenever a subscription renews, expires, is refunded or
 * revoked. There is no shared secret — the request is trusted only because the
 * payload is signed by Apple and verified against the pinned Apple Root CA.
 *
 * Configure the URL in App Store Connect → App → App Information →
 * App Store Server Notifications (production and sandbox).
 */

type DecodedNotification = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

export const Route = createFileRoute("/api/public/appstore-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyAppleJws, verifyTransaction, grantsPremium, toIso, APP_BUNDLE_ID } =
          await import("@/lib/appstore.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let notification: DecodedNotification;
        try {
          const body = (await request.json()) as { signedPayload?: string };
          if (!body?.signedPayload) return new Response("missing payload", { status: 400 });
          notification = await verifyAppleJws<DecodedNotification>(body.signedPayload);
        } catch (error) {
          // Unverifiable payloads are dropped without touching any entitlement.
          return new Response(`invalid: ${(error as Error).message}`, { status: 401 });
        }

        if (notification.data?.bundleId && notification.data.bundleId !== APP_BUNDLE_ID) {
          return new Response("wrong bundle", { status: 400 });
        }

        const log = async (status: string, detail: string | null, originalTx: string | null) => {
          await supabaseAdmin.from("apple_notifications").upsert(
            {
              notification_uuid: notification.notificationUUID ?? null,
              notification_type: notification.notificationType ?? null,
              subtype: notification.subtype ?? null,
              original_transaction_id: originalTx,
              status,
              detail,
            },
            { onConflict: "notification_uuid" },
          );
        };

        const signedTransaction = notification.data?.signedTransactionInfo;
        if (!signedTransaction) {
          await log("ignored", "no transaction info", null);
          return Response.json({ ok: true });
        }

        let tx;
        try {
          tx = await verifyTransaction(signedTransaction);
        } catch (error) {
          await log("rejected", (error as Error).message, null);
          return new Response("invalid transaction", { status: 401 });
        }

        const originalTransactionId = tx.originalTransactionId ?? tx.transactionId ?? null;
        if (!originalTransactionId) {
          await log("ignored", "no original transaction id", null);
          return Response.json({ ok: true });
        }

        const revoked =
          !!tx.revocationDate ||
          notification.notificationType === "REFUND" ||
          notification.notificationType === "REVOKE";
        const active = !revoked && grantsPremium(tx);

        const patch = {
          is_active: active,
          product_id: tx.productId ?? null,
          expires_at: toIso(tx.expiresDate),
          revoked_at: revoked ? (toIso(tx.revocationDate) ?? new Date().toISOString()) : null,
          transaction_id: tx.transactionId ?? null,
          environment: tx.environment ?? notification.data?.environment ?? null,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: updated, error } = await supabaseAdmin
          .from("premium_entitlements")
          .update(patch)
          .eq("original_transaction_id", originalTransactionId)
          .select("user_id");

        if (error) {
          await log("error", error.message, originalTransactionId);
          return new Response("error", { status: 500 });
        }

        // The very first notification can arrive before the app has submitted
        // its transaction. `appAccountToken` is the BeenBy user id we set at
        // purchase time, so we can still create the row.
        if ((updated?.length ?? 0) === 0 && tx.appAccountToken) {
          await supabaseAdmin.from("premium_entitlements").upsert(
            {
              user_id: tx.appAccountToken,
              platform: "ios",
              original_transaction_id: originalTransactionId,
              ...patch,
            },
            { onConflict: "user_id" },
          );
        }

        await log("applied", notification.notificationType ?? null, originalTransactionId);
        return Response.json({ ok: true });
      },
    },
  },
});
