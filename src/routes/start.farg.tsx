import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearDraft, patchDraft, type OnboardingDraft } from "@/lib/onboardingDraft";
import { saveRecovery } from "@/lib/recovery";

export const Route = createFileRoute("/start/farg")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Välj din färg – Nära" },
      {
        name: "description",
        content: "Sista steget: välj färgen som visar dina besök i familjens översikt.",
      },
      { property: "og:title", content: "Välj din färg – Nära" },
      {
        property: "og:description",
        content: "Färgen visar vem som varit på besök i familjens 28-dagarsvy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColorPage,
});

function ColorPage() {
  return <StartShell>{({ userId, draft }) => <ColorStep userId={userId} draft={draft} />}</StartShell>;
}

function ColorStep({ userId, draft }: { userId: string; draft: OnboardingDraft }) {
  const navigate = useNavigate();
  const [color, setColor] = useState<string | null>(draft.color);
  const [saving, setSaving] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";

  async function create() {
    setSaving(true);
    try {
      const { data: circle, error: cErr } = await supabase
        .from("family_circles")
        .insert({ name: draft.personName.trim(), timezone, created_by: userId })
        .select("id, family_code")
        .single();
      if (cErr) throw cErr;

      const { error: pErr } = await supabase.from("persons").insert({
        family_circle_id: circle.id,
        name: draft.personName.trim(),
        address: draft.resolvedAddress ?? (draft.address.trim() || null),
        location_latitude: draft.lat,
        location_longitude: draft.lng,
      });
      if (pErr) throw pErr;

      const { error: mErr } = await supabase.from("family_members").insert({
        family_circle_id: circle.id,
        user_id: userId,
        personal_color: color ?? "blue",
        role: "owner",
      });
      if (mErr) throw mErr;

      await supabase.from("profiles").upsert({ id: userId, name: draft.myName.trim() });
      saveRecovery({
        code: circle.family_code,
        name: draft.myName.trim(),
        color: color ?? "blue",
      });
      clearDraft();
      void navigate({ to: "/" });
    } catch (error) {
      console.error(error);
      toast.error("Det gick inte att skapa familjecirkeln. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl leading-snug">Välj din färg</h1>
        <p className="text-sm text-muted-foreground">Din färg visar dina besök i familjens översikt.</p>
      </div>
      <ColorPicker
        value={color}
        onChange={(next) => {
          setColor(next);
          patchDraft({ color: next ?? "blue" });
        }}
      />
      <Button
        className="h-12 w-full rounded-2xl text-sm"
        disabled={!color || saving}
        onClick={() => void create()}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Skapa {draft.personName.trim() || "familjens"}s familjecirkel
      </Button>
      <button
        type="button"
        className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => void navigate({ to: "/start/adress" })}
      >
        Tillbaka
      </button>
    </>
  );
}
