/**
 * Server-only account lifecycle. Shared by the TanStack server functions (web)
 * and the HTTPS endpoints the native iOS app calls
 * (`/api/public/native/account`), so both paths delete exactly the same data.
 *
 * `userId` is always derived from a verified Supabase JWT by the caller.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type UserClient = SupabaseClient<Database>;

/** Leave a family circle. Runs as the user, so RLS still applies. */
export async function leaveCircle(supabase: UserClient, circleId: string) {
  const { data: ok, error } = await supabase.rpc("leave_family_circle", { _circle: circleId });
  if (error) return { ok: false as const, error: error.message };
  return { ok: ok === true };
}

/**
 * Permanently deletes the user: profile, memberships, own messages (including
 * their images in Storage), own visits and plans, device tokens, purchase
 * record and finally the login itself. Other members' entries are kept.
 */
export async function deleteUserAccount(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: images, error } = await supabaseAdmin.rpc("delete_my_account_for", {
    _user: userId,
  });
  if (error) return { ok: false as const, error: error.message };

  const paths = (images ?? [])
    .map((row: { image_path: string | null }) => row.image_path)
    .filter((value: string | null): value is string => typeof value === "string" && value.length > 0);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("chat-images").remove(paths);
  }

  // Only when every other cleanup step succeeded is the auth user removed.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) return { ok: false as const, error: authError.message };

  return { ok: true as const };
}
