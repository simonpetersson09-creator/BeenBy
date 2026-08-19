/**
 * Leaving a family and deleting the account (web build). Thin wrappers around
 * `account.server.ts`, which the native iOS HTTPS endpoint uses as well.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Leave a family circle. Access is gone immediately (row level security). */
export const leaveFamilyCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const circleId = (data as { circleId?: unknown } | null)?.circleId;
    if (typeof circleId !== "string" || circleId.length < 10) throw new Error("invalid circle");
    return { circleId };
  })
  .handler(async ({ data, context }) => {
    const { leaveCircle } = await import("@/lib/account.server");
    return leaveCircle(context.supabase, data.circleId);
  });

/** Permanently deletes the signed-in user and everything that is only theirs. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteUserAccount } = await import("@/lib/account.server");
    return deleteUserAccount(context.userId);
  });
