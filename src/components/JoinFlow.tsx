import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { getDraft, patchDraft } from "@/lib/onboardingDraft";
import { saveRecovery } from "@/lib/recovery";

type Preview = {
  circle_id: string | null;
  circle_name: string | null;
  person_name: string | null;
  taken_colors: string[] | null;
  status: string;
};

export function JoinFlow({
  token,
  code,
  onJoined,
  onCancel,
}: {
  token?: string;
  code?: string;
  onJoined: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => getDraft().myName);
  const [color, setColor] = useState<string | null>(() => getDraft().color || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .rpc("preview_invite", { ...(token ? { _token: token } : {}), ...(code ? { _code: code } : {}) })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error(error);
          setPreview({
            circle_id: null,
            circle_name: null,
            person_name: null,
            taken_colors: [],
            status: "invalid",
          });
        } else {
          setPreview((data as Preview[])?.[0] ?? null);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, code]);

  async function join() {
    if (!color) return;
    setSaving(true);
    const { data: joinedId, error } = await supabase.rpc("join_circle", {
      _name: name.trim(),
      _color: color,
      ...(token ? { _token: token } : {}),
      ...(code ? { _code: code } : {}),
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(
        error.message.includes("expired")
          ? t("join.errExpired")
          : t("join.errGeneric"),
      );
      return;
    }
    if (joinedId) {
      const { data: joined } = await supabase
        .from("family_circles")
        .select("family_code")
        .eq("id", joinedId as string)
        .maybeSingle();
      if (joined?.family_code) {
        saveRecovery({ code: joined.family_code, name: name.trim(), color });
      }
    }
    onJoined();
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview || preview.status !== "ok") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl">
          {preview?.status === "expired" ? t("join.expiredTitle") : t("join.invalidTitle")}
        </h1>
        <p className="text-muted-foreground">
          {preview?.status === "expired"
            ? t("join.expiredDesc")
            : t("join.invalidDesc")}
        </p>
        {onCancel ? (
          <Button variant="secondary" className="h-12 rounded-2xl" onClick={onCancel}>
            {t("common.back")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-scroll mx-auto flex h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl">
          {t("join.title", { name: preview.person_name ?? preview.circle_name ?? "" })}
        </h1>
        <p className="text-muted-foreground">
          {t("join.sub", { name: preview.person_name ?? preview.circle_name ?? "" })}
        </p>
      </div>


      <div className="space-y-2">
        <Label htmlFor="join-name">{t("join.nameLabel")}</Label>
        <Input
          id="join-name"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            patchDraft({ myName: e.target.value });
          }}
          placeholder={t("join.namePlaceholder")}
          className="h-14 rounded-2xl text-lg"
        />
      </div>

      <div className="space-y-3">
        <Label>{t("join.colorLabel")}</Label>
        <ColorPicker
          value={color}
          onChange={(next) => {
            setColor(next);
            patchDraft({ color: next });
          }}
          taken={preview.taken_colors ?? []}
        />
      </div>

      <Button
        size="lg"
        className="h-14 w-full rounded-2xl text-base"
        disabled={!color || name.trim().length < 1 || saving}
        onClick={join}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("join.cta")}
      </Button>
      {onCancel ? (
        <Button variant="ghost" onClick={onCancel}>
          {t("join.cancel")}
        </Button>
      ) : null}
    </div>
  );
}
