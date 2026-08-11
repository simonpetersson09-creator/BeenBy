/**
 * Shared geocoding helpers used by both the web (server function) build and the
 * static Capacitor/iOS client build. No secrets involved — Nominatim is a public API.
 */

export type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  title: string;
  subtitle: string;
  precise: boolean;
};

export type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

export function buildGeocodeUrl(query: string): string {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "sv");
  url.searchParams.set("countrycodes", "se");
  return url.toString();
}

export function parseGeocodeResults(json: NominatimHit[]): GeocodeHit[] {
  return json.map((hit) => {
    const a = hit.address ?? {};
    const street = [a["road"], a["house_number"]].filter(Boolean).join(" ");
    const city = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"] ?? "";
    const precise = Boolean(a["house_number"]);
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name,
      title: street || city || hit.display_name.split(",")[0]!,
      subtitle: [a["postcode"], city, a["county"]].filter(Boolean).join(", "),
      precise,
    };
  });
}
