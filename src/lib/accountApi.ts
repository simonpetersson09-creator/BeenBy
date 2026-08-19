/**
 * Leaving a family and deleting the profile — in both build targets.
 *
 * Web/SSR uses the TanStack server function; the Capacitor/iOS build calls the
 * published backend over authenticated HTTPS. The server derives the user from
 * the verified Supabase token in both cases.
 */
import { callNativeApi } from "@/lib/nativeApi";
import { IS_NATIVE_SPA } from "@/lib/runtime";

type Result = { ok: boolean; error?: string };

/**
 * Leaving runs as the signed-in user through row level security, so no
 * privileged server step is needed. Calling the database directly means it
 * works identically on web and in the iOS app, even before publishing.
 */
export async function leaveFamily(circleId: string): Promise<Result> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("leave_family_circle", { _circle: circleId });
  if (error) return { ok: false, error: error.message };
  return { ok: data === true };
}

export async function deleteMyAccount(): Promise<Result> {
  if (IS_NATIVE_SPA) {
    return callNativeApi<Result>("account", { action: "delete" });
  }
  const { deleteAccount } = await import("@/lib/account.functions");
  return deleteAccount();
}
