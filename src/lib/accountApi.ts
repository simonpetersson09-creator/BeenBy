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

export async function leaveFamily(circleId: string): Promise<Result> {
  if (IS_NATIVE_SPA) {
    return callNativeApi<Result>("account", { action: "leave", circleId });
  }
  const { leaveFamilyCircle } = await import("@/lib/account.functions");
  return leaveFamilyCircle({ data: { circleId } });
}

export async function deleteMyAccount(): Promise<Result> {
  if (IS_NATIVE_SPA) {
    return callNativeApi<Result>("account", { action: "delete" });
  }
  const { deleteAccount } = await import("@/lib/account.functions");
  return deleteAccount();
}
