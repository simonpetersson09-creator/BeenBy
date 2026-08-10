import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ query: z.string().min(3).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", data.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "sv");
    url.searchParams.set("countrycodes", "se");

    const res = await fetch(url, {
      headers: { "User-Agent": "BeenBy/1.0 (address lookup)", Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Geocoding failed [${res.status}]: ${await res.text()}`);
    }
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;

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
  });
