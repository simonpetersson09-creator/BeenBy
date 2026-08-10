import { useState } from "react";
import { ArrowRight, MapPin, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/geocode.functions";
import { saveRecovery } from "@/lib/recovery";

type Coords = { lat: number; lng: number } | null;

export function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [personName, setPersonName] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [coords, setCoords] = useState<Coords>(null);
  const [address, setAddress] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [myName, setMyName] = useState("");
  const [color, setColor] = useState<string | null>("blue");
  const [saving, setSaving] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";

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

  async function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Platstjänster stöds inte här. Du kan hoppa över det här steget.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setResolvedAddress(null);
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


  async function create() {
    setSaving(true);
    try {
      const { data: circle, error: cErr } = await supabase
        .from("family_circles")
        .insert({ name: personName.trim(), timezone, created_by: userId })
        .select("id, family_code")
        .single();
      if (cErr) throw cErr;

      const { error: pErr } = await supabase.from("persons").insert({
        family_circle_id: circle.id,
        name: personName.trim(),
        location_latitude: coords?.lat ?? null,
        location_longitude: coords?.lng ?? null,
      });
      if (pErr) throw pErr;

      const { error: mErr } = await supabase.from("family_members").insert({
        family_circle_id: circle.id,
        user_id: userId,
        personal_color: color ?? "blue",
        role: "owner",
      });
      if (mErr) throw mErr;

      await supabase.from("profiles").upsert({ id: userId, name: myName.trim() });
      saveRecovery({
        code: circle.family_code,
        name: myName.trim(),
        color: color ?? "blue",
      });
      onDone();
    } catch (error) {
      console.error(error);
      toast.error("Det gick inte att skapa familjecirkeln. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-8">
      <div key={step} className="animate-rise-in space-y-4">
        {step === 0 ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl leading-snug">Vem vill ni hålla kontakten med?</h1>
              <p className="text-sm text-muted-foreground">
                Välj ett alternativ, eller skriv ett eget namn.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Mamma", "Pappa"].map((n) => (
                <Button
                  key={n}
                  variant={personName === n ? "default" : "secondary"}
                  className="h-12 rounded-2xl text-sm"
                  onClick={() => {
                    setPersonName(n);
                    setCustomMode(false);
                  }}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant={customMode ? "default" : "secondary"}
                className="col-span-2 h-12 rounded-2xl text-sm"
                onClick={() => {
                  setCustomMode(true);
                  setPersonName("");
                }}
              >
                Valfritt namn
              </Button>
            </div>
            {customMode ? (
              <div className="space-y-1.5">
                <Label htmlFor="person" className="text-xs">
                  Namn
                </Label>
                <Input
                  id="person"
                  value={personName}
                  autoFocus
                  maxLength={60}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Karin"
                  className="h-12 rounded-2xl text-base"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="me" className="text-xs">
                Vad heter du?
              </Label>
              <Input
                id="me"
                value={myName}
                maxLength={60}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Ditt namn"
                className="h-12 rounded-2xl text-base"
              />
            </div>
            <Button
              className="h-12 w-full rounded-2xl text-sm"
              disabled={personName.trim().length < 1 || myName.trim().length < 1}
              onClick={() => setStep(1)}
            >
              Fortsätt <ArrowRight className="size-4" />
            </Button>
          </>
        ) : null}


        {step === 1 ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl leading-snug">Var bor {personName.trim()}?</h1>
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
              {resolvedAddress ? (
                <p className="text-xs text-muted-foreground">{resolvedAddress}</p>
              ) : null}
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
            <Button className="h-12 w-full rounded-2xl text-sm" onClick={() => setStep(2)}>
              {coords ? "Fortsätt" : "Hoppa över"} <ArrowRight className="size-4" />
            </Button>
          </>
        ) : null}


        {step === 2 ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl leading-snug">Välj din färg</h1>
              <p className="text-sm text-muted-foreground">
                Din färg visar dina besök i familjens översikt.
              </p>
            </div>
            <ColorPicker value={color} onChange={setColor} />
            <Button
              className="h-12 w-full rounded-2xl text-sm"
              disabled={!color || saving}
              onClick={create}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Skapa {personName.trim()}s familjecirkel
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
