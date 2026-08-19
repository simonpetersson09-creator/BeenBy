import { createFileRoute } from "@tanstack/react-router";

import {
  authenticate,
  jsonResponse,
  preflight,
  rateLimit,
  readBody,
} from "@/lib/nativeApi.server";

/**
 * Account lifecycle for the native iOS app.
 *
 * POST { action: "leave", circleId } | { action: "delete" }
 * with `Authorization: Bearer <supabase access token>`.
 *
 * The account that is left or deleted is always the one the verified token
 * belongs to — a client can never pass someone else's user id.
 */
export const Route = createFileRoute("/api/public/native/account")({
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
        const { leaveCircle, deleteUserAccount } = await import("@/lib/account.server");

        if (action === "leave") {
          const circleId = body["circleId"];
          if (typeof circleId !== "string" || circleId.length < 10) {
            return jsonResponse(request, { error: "invalid circle" }, 400);
          }
          const limited = await rateLimit(request, supabase, "native_leave", 10, 60);
          if (limited) return limited;
          return jsonResponse(request, await leaveCircle(supabase, circleId));
        }

        if (action === "delete") {
          const limited = await rateLimit(request, supabase, "native_delete", 5, 300);
          if (limited) return limited;
          return jsonResponse(request, await deleteUserAccount(userId));
        }

        return jsonResponse(request, { error: "unknown action" }, 400);
      },
    },
  },
});
