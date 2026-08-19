/**
 * Shared plumbing for the HTTPS endpoints the native iOS app calls.
 *
 * The Capacitor build ships a static SPA with no server on the device, so it
 * talks to the published BeenBy backend over HTTPS instead of through TanStack
 * server functions. Every endpoint here:
 *   - requires an `Authorization: Bearer <supabase access token>` header,
 *   - derives the user id from the VERIFIED token (never from the body),
 *   - caps the request body,
 *   - answers CORS only for the app's own origins.
 * Nothing is logged that could contain a token, JWS or secret.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** 32 KB is far more than any of these payloads needs (largest is a JWS). */
const MAX_BODY_BYTES = 32 * 1024;

/** WKWebView origins used by Capacitor, plus localhost for `npm run dev`. */
const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:8080",
]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "capacitor://localhost";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Verifies the bearer token and returns a Supabase client acting AS that user
 * (RLS applies) together with the user id taken from the token claims.
 */
export async function authenticate(
  request: Request,
): Promise<{ supabase: SupabaseClient<Database>; userId: string } | Response> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return jsonResponse(request, { error: "server misconfigured" }, 500);

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return jsonResponse(request, { error: "unauthorized" }, 401);
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return jsonResponse(request, { error: "unauthorized" }, 401);

  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return jsonResponse(request, { error: "unauthorized" }, 401);

  return { supabase, userId };
}

/** Parses a small JSON body, refusing anything oversized or malformed. */
export async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(request, { error: "payload too large" }, 413);
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return jsonResponse(request, { error: "payload too large" }, 413);
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse(request, { error: "invalid body" }, 400);
    }
    return parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(request, { error: "invalid body" }, 400);
  }
}

/**
 * Per-user rate limit through the existing `enforce_rate_limit` RPC, which
 * counts against `auth.uid()` in the database. Returns a Response when the
 * caller is over the limit.
 */
export async function rateLimit(
  request: Request,
  supabase: SupabaseClient<Database>,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const { error } = await supabase.rpc("enforce_rate_limit", {
    _bucket: bucket,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (error) return jsonResponse(request, { error: "rate_limited" }, 429);
  return null;
}
