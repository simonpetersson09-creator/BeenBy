import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { editSearch } from "@/lib/circleEdit";
import { patchDraft } from "@/lib/onboardingDraft";

export const Route = createFileRoute("/start/vem")({
  ssr: false,
  validateSearch: editSearch,
  head: () => ({
    meta: [
      { title: "Who do you want to stay in touch with? – BeenBy" },
      {
        name: "description",
        content: "Step one: choose who the family stays in touch with and enter your own name.",
      },
      { property: "og:title", content: "Who do you want to stay in touch with? – BeenBy" },
      {
        property: "og:description",
        content: "Get started in under a minute – pick the person and type your name.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhoPage,
});

function WhoPage() {
  const navigate = useNavigate();
  const { edit } = Route.useSearch();
  return (
    <StartShell
      onBack={() =>
        void navigate(edit ? { to: "/" } : { to: "/start/valkommen" })
      }
    >
      {({ draft }) => (
        <WhoStep
          initialPerson={draft.personName}
          initialMe={draft.myName}
          edit={Boolean(edit)}
        />
      )}
    </StartShell>
  );
}

function WhoStep({
  initialPerson,
  initialMe,
  edit,
}: {
  initialPerson: string;
  initialMe: string;
  edit?: boolean;
}) {
  const navigate = useNavigate();
  const t = useT();
  const [personName, setPersonName] = useState(initialPerson);
  const [myName, setMyName] = useState(initialMe);
  const [customMode, setCustomMode] = useState(
    Boolean(initialPerson) && !["Mamma", "Pappa"].includes(initialPerson),
  );

  const presets = [
    { key: "vem.mamma", value: "Mamma" },
    { key: "vem.pappa", value: "Pappa" },
  ];

  return (
    <>
      <div className="space-y-0.5">
        <h1 className="text-2xl leading-snug">{t("vem.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("vem.sub")}</p>
      </div>

      <section className="space-y-2 rounded-2xl border border-primary/25 bg-card/60 p-2.5">
        <SectionHeader step={1} title={t("vem.s1.title")} hint={t("vem.s1.hint")} />
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <Button
              key={p.value}
              variant={personName === p.value && !customMode ? "default" : "secondary"}
              className="h-11 rounded-2xl text-sm"
              onClick={() => {
                setPersonName(p.value);
                setCustomMode(false);
                patchDraft({ personName: p.value });
              }}
            >
              {t(p.key)}
            </Button>
          ))}
          <Button
            variant={customMode ? "default" : "secondary"}
            className="col-span-2 h-11 rounded-2xl text-sm"
            onClick={() => {
              setCustomMode(true);
              setPersonName("");
              patchDraft({ personName: "" });
            }}
          >
            {t("vem.custom")}
          </Button>
        </div>
        {customMode ? (
          <div className="space-y-1.5">
            <Label htmlFor="person" className="text-xs">
              {t("vem.nameLabel")}
            </Label>
            <Input
              id="person"
              value={personName}
              autoFocus
              maxLength={60}
              onChange={(e) => {
                setPersonName(e.target.value);
                patchDraft({ personName: e.target.value });
              }}
              placeholder={t("vem.namePlaceholder")}
              className="h-11 rounded-2xl text-base"
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded-2xl border border-primary/25 bg-card/60 p-2.5">
        <SectionHeader step={2} title={t("vem.s2.title")} hint={t("vem.s2.hint")} />
        <Input
          id="me"
          value={myName}
          maxLength={60}
          onChange={(e) => {
            setMyName(e.target.value);
            patchDraft({ myName: e.target.value });
          }}
          placeholder={t("vem.mePlaceholder")}
          className="h-11 rounded-2xl text-base"
        />
      </section>

      <Button
        className="h-11 w-full rounded-2xl text-sm"
        disabled={personName.trim().length < 1 || myName.trim().length < 1}
        onClick={() => {
          patchDraft({ personName: personName.trim(), myName: myName.trim() });
          void navigate({ to: "/start/adress" });
        }}
      >
        {t("common.continue")} <ArrowRight className="size-4" />
      </Button>

    </>
  );
}

function SectionHeader({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {step}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm leading-none font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
