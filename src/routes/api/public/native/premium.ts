import { createFileRoute } from "@tanstack/react-router";

import {
  authenticate,
  jsonResponse,
  preflight,
  rateLimit,
  readBody,
} from "@/lib/nativeApi.server";

/**
 * Premium for the native iOS app (no TanStack server exists on the device).
 *
 * POST { action: "entitlement" | "submit" | "anchor", jws?, anchor? }
 * with `Authorization: Bearer <supabase access token>`.
 *
 * The user is resolved from the verified token; a client-sent user id is
 * ignored. StoreKit's JWS is verified against Apple's pinned certificate chain
 * server-side, and only this endpoint (service role) writes
 * `premium_entitlements`, which stays the source of truth for `has_app_access()`.
 */
export const Route = createFileRoute("/api/public/native/premium")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { supabase, userId } = auth;

        const body = await readBody(request);
        if (body instanceof Response) return body;

        const action = body["action"];
        const {
          readEntitlement,
          applyTransaction,
          claimAnchor,
        } = await import("@/lib/premium.server");

        if (action === "entitlement") {
          const limited = await rateLimit(request, supabase, "native_entitlement", 60, 60);
          if (limited) return limited;
          return jsonResponse(request, await readEntitlement(supabase, userId));
        }

        if (action === "submit") {
          const jws = body["jws"];
          if (typeof jws !== "string" || jws.length < 20 || jws.length > 20000) {
            return jsonResponse(request, { error: "invalid transaction" }, 400);
          }
          const limited = await rateLimit(request, supabase, "native_submit_tx", 20, 60);
          if (limited) return limited;
          return jsonResponse(request, await applyTransaction(userId, jws));
        }

        if (action === "anchor") {
          const anchor = body["anchor"];
          if (typeof anchor !== "string" || anchor.length < 8 || anchor.length > 200) {
            return jsonResponse(request, { error: "invalid anchor" }, 400);
          }
          const limited = await rateLimit(request, supabase, "native_anchor", 20, 60);
          if (limited) return limited;
          return jsonResponse(request, await claimAnchor(supabase, anchor));
        }

        return jsonResponse(request, { error: "unknown action" }, 400);
      },
    },
  },
});
