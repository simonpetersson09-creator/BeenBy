import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { buildGeocodeUrl, parseGeocodeResults, type NominatimHit } from "./geocodeShared";

/**
 * Address lookup proxy. Requires a signed-in BeenBy user and is rate limited
 * server-side (20/minute, 500/day per user) so it can never be used as an open
 * public proxy against Nominatim.
 */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ query: z.string().min(3).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("rate_limit_geocode");
    if (allowed !== true) {
      throw new Error("rate_limited");
    }
    const res = await fetch(buildGeocodeUrl(data.query), {
      headers: { "User-Agent": "BeenBy/1.0 (address lookup)", Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Geocoding failed [${res.status}]`);
    }
    return parseGeocodeResults((await res.json()) as NominatimHit[]);
  });
