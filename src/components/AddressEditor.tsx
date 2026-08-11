import { useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { PinMap } from "@/components/onboarding/PinMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { searchAddress, type GeocodeHit } from "@/lib/geocode";
import { useT } from "@/lib/i18n";

export type EditablePerson = {
  id: string;
  name: string;
  address: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
};

/**
 * Add or change the saved visiting address for a person, after onboarding.
 * Reuses the exact same geocoding (searchAddress) and map pin (PinMap) as the
 * onboarding step. Only address / location_latitude / location_longitude are
 * written — geofence_radius is never touched here.
 */
export function AddressEditor({
  person,
  open,
  onOpenChange,
  onSaved,
}: {
  person: EditablePerson;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (() => void) | undefined;
}) {
  const t = useT();
  const [query, setQuery] = useState(person.address ?? "");
  const [resolved, setResolved] = useState<string | null>(person.address);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    person.location_latitude != null && person.location_longitude != null
      ? { lat: person.location_latitude, lng: person.location_longitude }
      : null,
  );
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  async function lookup() {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const hits = await searchAddress(q);
      setResults(hits);
      if (hits.length === 0) toast.error(t("adress.noHits"));
      else if (hits.length === 1) selectHit(hits[0]!);
    } catch (error) {
      console.error(error);
      toast.error(t("adress.searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  function selectHit(hit: GeocodeHit) {
    setCoords({ lat: hit.lat, lng: hit.lng });
    setResolved(hit.label);
    setResults([]);
  }

  async function save() {
    if (!coords || !resolved) return;
    setSaving(true);
    // Only these three columns — geofence_radius is intentionally left as is.
    const { error } = await supabase
      .from("persons")
      .update({
        address: resolved,
        location_latitude: coords.lat,
        location_longitude: coords.lng,
      })
      .eq("id", person.id);
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(t("address.saveFailed"));
      return;
    }
    toast.success(t("address.saved"));
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("address.title")}</DialogTitle>
          <DialogDescription>
            {t("address.sub", { name: pl(person.name) })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            maxLength={200}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookup();
            }}
            placeholder={t("adress.placeholder")}
            className="h-12 rounded-2xl text-base"
          />
          <Button
            variant="secondary"
            className="h-12 shrink-0 rounded-2xl px-4"
            onClick={() => void lookup()}
            disabled={searching || query.trim().length < 3}
            aria-label={t("adress.search")}
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>

        {results.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {results.map((hit) => (
              <li key={hit.label}>
                <button
                  type="button"
                  onClick={() => selectHit(hit)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{hit.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.subtitle || hit.label}
                      {hit.precise ? "" : t("adress.approx")}
                    </span>
                  </span>
                  {resolved === hit.label ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {coords ? (
          <div className="space-y-2 rounded-2xl border border-primary/40 p-2">
            <PinMap
              lat={coords.lat}
              lng={coords.lng}
              onChange={(next) => setCoords(next)}
            />
            <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">{resolved ?? query}</span>
            </p>
            <p className="px-1 text-xs text-muted-foreground">{t("adress.dragHint")}</p>
          </div>
        ) : null}

        <Button
          className="h-12 w-full rounded-2xl text-base"
          disabled={!coords || !resolved || saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t("address.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
