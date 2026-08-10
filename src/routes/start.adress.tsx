import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { geocodeAddress } from "@/lib/geocode.functions";
import { patchDraft, type OnboardingDraft } from "@/lib/onboardingDraft";

export const Route = createFileRoute("/start/adress")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Var bor personen? – Nära" },
      {
        name: "description",
        content: "Ange adressen som utgångspunkt för besöken. Platsdelning är helt frivillig.",
      },
      { property: "og:title", content: "Var bor personen? – Nära" },
      {
        property: "og:description",
        content: "Adressen används som utgångspunkt – ingen i familjen ser var du befinner dig.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddressPage,
});

function AddressPage() {
  return <StartShell>{({ draft }) => <AddressStep draft={draft} />}</StartShell>;
}

function AddressStep({ draft }: { draft: OnboardingDraft }) {
  const navigate = useNavigate();
  const [address, setAddress] = useState(draft.address);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(draft.resolvedAddress);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null,
  );
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  async function lookupAddress() {
    const query = address.trim();
    if (query.length < 3) return;
    setSearching(true);
    try {
      const hit = await geocodeAddress({ data: { query } });
      if (!hit) {
        setResolvedAddress(null);
        toast.error("Hittade ingen adress. Prova att skriva gata, nummer och ort.");
        return;
      }
      setCoords({ lat: hit.lat, lng: hit.lng });
      setResolvedAddress(hit.label);
      toast.success("Adressen är sparad som utgångspunkt.");
    } catch (error) {
      console.error(error);
      toast.error("Adressökningen misslyckades. Försök igen.");
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Platstjänster stöds inte här. Du kan hoppa över det här steget.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Platsen sparad som referenspunkt.");
      },
      () => {
        setLocating(false);
        toast.message("Ingen plats sparad", {
          description: "Appen fungerar precis lika bra utan plats.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl leading-snug">Var bor {draft.personName || "personen"}?</h1>
        <p className="text-sm text-muted-foreground">
          Ange adressen som utgångspunkt. Ingen i familjen kan se var du befinner dig.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-xs">
          Adress
        </Label>
        <div className="flex gap-2">
          <Input
            id="address"
            value={address}
            maxLength={200}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookupAddress();
            }}
            placeholder="Storgatan 1, Stockholm"
            className="h-12 rounded-2xl text-base"
          />
          <Button
            variant="secondary"
            className="h-12 shrink-0 rounded-2xl px-4"
            onClick={() => void lookupAddress()}
            disabled={searching || address.trim().length < 3}
            aria-label="Sök adress"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>
        {resolvedAddress ? <p className="text-xs text-muted-foreground">{resolvedAddress}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Button
          variant="secondary"
          className="h-12 w-full rounded-2xl text-sm"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          Använd min nuvarande plats
        </Button>
        <p className="text-xs text-muted-foreground">
          Används bara för att du ska kunna få en notis när du varit på besök.
        </p>
      </div>
      <Button
        className="h-12 w-full rounded-2xl text-sm"
        onClick={() => {
          patchDraft({
            address,
            resolvedAddress,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          });
          void navigate({ to: "/start/farg" });
        }}
      >
        {coords ? "Fortsätt" : "Hoppa över"} <ArrowRight className="size-4" />
      </Button>
      <button
        type="button"
        className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => void navigate({ to: "/start/vem" })}
      >
        Tillbaka
      </button>
    </>
  );
}
