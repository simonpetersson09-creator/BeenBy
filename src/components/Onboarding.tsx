import { useState } from "react";
import { ArrowRight, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Coords = { lat: number; lng: number } | null;

export function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [personName, setPersonName] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [coords, setCoords] = useState<Coords>(null);
  const [locating, setLocating] = useState(false);
  const [myName, setMyName] = useState("");
  const [color, setColor] = useState<string | null>("blue");
  const [saving, setSaving] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";

  async function useCurrentLocation() {
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

  async function create() {
    setSaving(true);
    try {
      const { data: circle, error: cErr } = await supabase
        .from("family_circles")
        .insert({ name: personName.trim(), timezone, created_by: userId })
        .select("id")
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
            <Button
              className="h-12 w-full rounded-2xl text-sm"
              disabled={personName.trim().length < 1}
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
                Platsen används bara som referenspunkt när du är på besök. Ingen i familjen kan se var
                du befinner dig.
              </p>
            </div>
            <Button
              variant="secondary"
              className="h-12 w-full rounded-2xl text-sm"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              {coords ? "Platsen är sparad" : "Använd min nuvarande plats"}
            </Button>
            <Button className="h-12 w-full rounded-2xl text-sm" onClick={() => setStep(2)}>
              {coords ? "Fortsätt" : "Hoppa över"} <ArrowRight className="size-4" />
            </Button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl leading-snug">Vad heter du?</h1>
              <p className="text-sm text-muted-foreground">
                Så att familjen ser vem som varit på besök.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me" className="text-xs">
                Ditt namn
              </Label>
              <Input
                id="me"
                value={myName}
                autoFocus
                maxLength={60}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Simon"
                className="h-12 rounded-2xl text-base"
              />
            </div>
            <Button
              className="h-12 w-full rounded-2xl text-sm"
              disabled={myName.trim().length < 1}
              onClick={() => setStep(3)}
            >
              Fortsätt <ArrowRight className="size-4" />
            </Button>
          </>
        ) : null}

        {step === 3 ? (
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
