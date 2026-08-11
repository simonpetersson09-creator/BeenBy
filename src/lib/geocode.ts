import { IS_NATIVE_SPA } from "./runtime";
import {
  buildGeocodeUrl,
  parseGeocodeResults,
  type GeocodeHit,
  type NominatimHit,
} from "./geocodeShared";

export type { GeocodeHit };

/**
 * Address lookup that works in both build targets:
 * - Web/SSR: goes through the TanStack server function (same as before).
 * - Capacitor/iOS static build: calls the public Nominatim API directly from the
 *   WKWebView (CORS-enabled, no API key involved), since no Nitro server exists on device.
 */
export async function searchAddress(query: string): Promise<GeocodeHit[]> {
  if (IS_NATIVE_SPA) {
    const res = await fetch(buildGeocodeUrl(query), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Geocoding failed [${res.status}]`);
    }
    return parseGeocodeResults((await res.json()) as NominatimHit[]);
  }

  const { geocodeAddress } = await import("./geocode.functions");
  return geocodeAddress({ data: { query } });
}
