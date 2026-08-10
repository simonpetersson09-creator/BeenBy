import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { PinMap } from "@/components/onboarding/PinMap";
import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { geocodeAddress } from "@/lib/geocode.functions";
import { patchDraft, type OnboardingDraft } from "@/lib/onboardingDraft";

type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  title: string;
  subtitle: string;
  precise: boolean;
};

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
  const t = useT();
  const [address, setAddress] = useState(draft.address);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(draft.resolvedAddress);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null,
  );
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  async function lookupAddress() {
    const query = address.trim();
    if (query.length < 3) return;
    setSearching(true);
    try {
      const hits = await geocodeAddress({ data: { query } });
      setResults(hits);
      if (hits.length === 0) {
        toast.error(t("adress.noHits"));
        return;
      }
      if (hits.length === 1) selectHit(hits[0]!);
    } catch (error) {
      console.error(error);
      toast.error(t("adress.searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  function selectHit(hit: GeocodeHit) {
    setCoords({ lat: hit.lat, lng: hit.lng });
    setResolvedAddress(hit.label);
    patchDraft({
      address,
      resolvedAddress: hit.label,
      lat: hit.lat,
      lng: hit.lng,
    });
    setMapOpen(true);
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("adress.geoUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success(t("adress.saved"));
      },
      () => {
        setLocating(false);
        toast.message(t("adress.noLocation"), {
          description: t("adress.noLocationDesc"),
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl leading-snug">
          {t("adress.title", { name: draft.personName || t("adress.person") })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("adress.sub")}
        </p>
      </div>
      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader
          step={1}
          title={t("adress.s1.title")}
          hint={t("adress.s1.hint")}
          optional={t("common.optional")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="address" className="sr-only">
            {t("adress.label")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="address"
              value={address}
              maxLength={200}
              onChange={(e) => {
                setAddress(e.target.value);
                patchDraft({ address: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void lookupAddress();
              }}
              placeholder={t("adress.placeholder")}
              className="h-12 rounded-2xl text-base"
            />
            <Button
              variant="secondary"
              className="h-12 shrink-0 rounded-2xl px-4"
              onClick={() => void lookupAddress()}
              disabled={searching || address.trim().length < 3}
              aria-label={t("adress.search")}
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("adress.radiusHint")}
          </p>
        </div>
        {results.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {results.map((hit) => {
              const selected = resolvedAddress === hit.label;
              return (
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
                    {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {coords && resolvedAddress ? (
          mapOpen ? (
            <div className="space-y-2 rounded-2xl border border-primary/40 p-2">
               <PinMap
                 lat={coords.lat}
                 lng={coords.lng}
                 onChange={(next) => {
                   setCoords(next);
                   patchDraft({ lat: next.lat, lng: next.lng });
                 }}
               />
              <p className="px-1 text-xs text-muted-foreground">
                {t("adress.dragHint")}
              </p>
              <Button
                className="h-11 w-full rounded-2xl text-sm"
                onClick={() => {
                  setMapOpen(false);
                  toast.success(t("adress.pinSaved"));
                }}
              >
                <Check className="size-4" /> {t("adress.done")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-primary/40 px-3 py-2.5 text-left text-xs text-muted-foreground"
            >
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-foreground">{resolvedAddress}</span>
              <span className="shrink-0 underline underline-offset-4">{t("adress.adjust")}</span>
            </button>
          )
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader
          step={2}
          title={t("adress.s2.title")}
          hint={t("adress.s2.hint")}
          optional={t("common.optional")}
        />
        <Button
          variant="secondary"
          className="h-12 w-full rounded-2xl text-sm"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          {t("adress.useLocation")}
        </Button>
      </section>

      <section className="space-y-2 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader step={3} title={t("adress.s3.title")} hint={t("adress.s3.hint")} />
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
          {t("common.continue")} <ArrowRight className="size-4" />
        </Button>
        <button
          type="button"
          className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
          onClick={() => void navigate({ to: "/start/vem" })}
        >
          {t("common.back")}
        </button>
      </section>
    </>
  );
}

function SectionHeader({
  step,
  title,
  hint,
  optional,
}: {
  step: number;
  title: string;
  hint: string;
  optional?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {step}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm leading-none font-medium text-foreground">
          {title}
          {optional ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
              {optional}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
