import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildGeocodeUrl, parseGeocodeResults, type NominatimHit } from "./geocodeShared";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ query: z.string().min(3).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(buildGeocodeUrl(data.query), {
      headers: { "User-Agent": "BeenBy/1.0 (address lookup)", Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Geocoding failed [${res.status}]: ${await res.text()}`);
    }
    return parseGeocodeResults((await res.json()) as NominatimHit[]);
  });
