/**
 * HTTPS client for the native iOS build.
 *
 * The Capacitor bundle has no server on the device, so anything that must run
 * server-side goes to BeenBy's published backend over HTTPS, authenticated with
 * the user's current Supabase session. No secrets live in the app bundle — only
 * the (public) backend URL and the user's own access token.
 */
import { supabase } from "@/integrations/supabase/client";

/** Stable published backend URL; overridable at build time for staging. */
export const NATIVE_API_BASE: string =
  (import.meta.env["VITE_NATIVE_API_BASE"] as string | undefined)?.replace(/\/$/, "") ||
  "https://project--5306c12d-e1ba-402f-8e1d-dba155762875.lovable.app";

export class NativeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NativeApiError";
  }
}

/** POSTs to a `/api/public/native/*` endpoint with a fresh bearer token. */
export async function callNativeApi<T>(
  endpoint: "premium" | "account",
  body: Record<string, unknown>,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NativeApiError("no session", 401);

  const res = await fetch(`${NATIVE_API_BASE}/api/public/native/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // The response body may contain a server message, never a token.
    let detail = `request failed (${res.status})`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) detail = parsed.error;
    } catch {
      /* keep the generic message */
    }
    throw new NativeApiError(detail, res.status);
  }

  return (await res.json()) as T;
}
