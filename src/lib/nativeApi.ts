/**
 * HTTPS client for the native iOS build.
 *
 * The Capacitor bundle has no server on the device, so anything that must run
 * server-side goes to BeenBy's published backend over HTTPS, authenticated with
 * the user's current Supabase session. No secrets live in the app bundle — only
 * the (public) backend URL and the user's own access token.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Backend URLs the app may talk to, in order of preference. The production URL
 * only answers once the project has been published; before that it serves the
 * marketing/index HTML, which is not a usable API. The stable preview URL
 * always serves the latest build, so it is a safe fallback. A build time
 * override (staging) wins over both.
 */
const OVERRIDE = (import.meta.env["VITE_NATIVE_API_BASE"] as string | undefined)?.replace(/\/$/, "");
const API_BASES: string[] = OVERRIDE
  ? [OVERRIDE]
  : [
      "https://project--5306c12d-e1ba-402f-8e1d-dba155762875.lovable.app",
      "https://project--5306c12d-e1ba-402f-8e1d-dba155762875-dev.lovable.app",
    ];

/** Kept for callers/tests that only need the primary URL. */
export const NATIVE_API_BASE: string = API_BASES[0]!;

/** Remembered once a base has answered with a real API response. */
let resolvedBase: string | null = null;

export class NativeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NativeApiError";
  }
}

/** True when the response really came from the API and not from index.html. */
function isApiResponse(res: Response): boolean {
  if (res.status === 404) return false;
  return (res.headers.get("content-type") ?? "").includes("json");
}

/** POSTs to a `/api/public/native/*` endpoint with a fresh bearer token. */
export async function callNativeApi<T>(
  endpoint: "premium" | "account",
  body: Record<string, unknown>,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NativeApiError("no session", 401);

  const bases = resolvedBase ? [resolvedBase] : API_BASES;
  let lastError: NativeApiError = new NativeApiError("backend unavailable", 503);

  for (const base of bases) {
    let res: Response;
    try {
      res = await fetch(`${base}/api/public/native/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch {
      // Offline or DNS failure: try the next base, then give up.
      lastError = new NativeApiError("network error", 0);
      continue;
    }

    if (!isApiResponse(res)) {
      // This deployment has no API (not published yet) — try the next one.
      lastError = new NativeApiError("backend unavailable", res.status);
      continue;
    }

    resolvedBase = base;

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

  throw lastError;
}

