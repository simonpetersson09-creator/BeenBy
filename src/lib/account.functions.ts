/**
 * Leaving a family and deleting the account.
 *
 * Both run server-side so the user's own data really disappears — the app can
 * never do this correctly on its own (Storage objects and the auth user need
 * privileged access).
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
    const { data: ok, error } = await context.supabase.rpc("leave_family_circle", {
      _circle: data.circleId,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: ok === true };
  });

/**
 * Permanently deletes the signed-in user: profile, memberships, own messages
 * (including their images), own visits and plans, device tokens, purchase
 * record and finally the login itself. Other members' own entries are kept.
 */
export const deleteAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: images, error } = await supabaseAdmin.rpc("delete_my_account_for", {
      _user: context.userId,
    });
    if (error) return { ok: false as const, error: error.message };

    const paths = (images ?? [])
      .map((row: { image_path: string | null }) => row.image_path)
      .filter((value: string | null): value is string => typeof value === "string" && value.length > 0);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("chat-images").remove(paths);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (authError) return { ok: false as const, error: authError.message };

    return { ok: true as const };
  },
);
