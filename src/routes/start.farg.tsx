import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { editSearch, saveCircleEdit, takenColors } from "@/lib/circleEdit";
import { clearDraft, patchDraft, type OnboardingDraft } from "@/lib/onboardingDraft";
import { saveRecovery } from "@/lib/recovery";

export const Route = createFileRoute("/start/farg")({
  ssr: false,
  validateSearch: editSearch,
  head: () => ({
    meta: [
      { title: "Pick your colour – BeenBy" },
      {
        name: "description",
        content: "Final step: pick the colour that marks your visits in the family overview.",
      },
      { property: "og:title", content: "Pick your colour – BeenBy" },
      {
        property: "og:description",
        content: "The colour shows who has visited in the family's five-week overview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColorPage,
});

function ColorPage() {
  const navigate = useNavigate();
  const { edit } = Route.useSearch();
  const back = () =>
    void navigate(edit ? { to: "/start/adress", search: { edit: true } } : { to: "/start/adress" });
  return (
    <StartShell onBack={back}>
      {({ userId, draft }) => (
        <ColorStep userId={userId} draft={draft} edit={Boolean(edit)} onBack={back} />
      )}
    </StartShell>
  );
}

function ColorStep({
  userId,
  draft,
  edit,
  onBack,
}: {
  userId: string;
  draft: OnboardingDraft;
  edit: boolean;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const t = useT();
  const [color, setColor] = useState<string | null>(draft.color);
  const [saving, setSaving] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);

  useEffect(() => {
    if (!edit) return;
    let active = true;
    void takenColors(userId).then((list) => {
      if (active) setTaken(list);
    });
    return () => {
      active = false;
    };
  }, [edit, userId]);

  async function saveEdits() {
    if (!draft.personName.trim() || !draft.myName.trim()) {
      void navigate({ to: "/start/vem", search: { edit: true } });
      return;
    }
    setSaving(true);
    try {
      await saveCircleEdit(userId, {
        personName: draft.personName,
        myName: draft.myName,
        address: draft.resolvedAddress ?? (draft.address.trim() || null),
        lat: draft.lat,
        lng: draft.lng,
        color: color ?? "blue",
      });
      clearDraft();
      toast.success(t("edit.saved"));
      void navigate({ to: "/" });
    } catch (error) {
      console.error(error);
      toast.error(t("edit.error"));
    } finally {
      setSaving(false);
    }
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";

  async function create() {
    // Never create a nameless circle – that made the app look "reset".
    if (!draft.personName.trim() || !draft.myName.trim()) {
      void navigate({ to: "/start/vem" });
      return;
    }
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
      toast.error(t("farg.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-0.5">
        <h1 className="text-2xl leading-snug">{t("farg.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("farg.sub")}</p>
      </div>
      <ColorPicker
        value={color}
        onChange={(next) => {
          setColor(next);
          patchDraft({ color: next ?? "blue" });
        }}
      />
      <Button
        className="h-11 w-full rounded-2xl text-sm"
        disabled={!color || saving}
        onClick={() => void create()}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("farg.create")}
      </Button>
      <button
        type="button"
        className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => void navigate({ to: "/start/adress" })}
      >
        {t("common.back")}
      </button>
    </>
  );
}
