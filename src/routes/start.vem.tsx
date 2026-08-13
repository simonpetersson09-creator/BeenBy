import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";

import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { patchDraft } from "@/lib/onboardingDraft";

export const Route = createFileRoute("/start/vem")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vem vill ni hålla kontakten med? – Nära" },
      {
        name: "description",
        content: "Första steget: välj vem familjen håller kontakten med och ange ditt eget namn.",
      },
      { property: "og:title", content: "Vem vill ni hålla kontakten med? – Nära" },
      {
        property: "og:description",
        content: "Kom igång på under en minut – välj person och skriv ditt namn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhoPage,
});

function WhoPage() {
  const navigate = useNavigate();
  return (
    <StartShell onBack={() => void navigate({ to: "/start/valkommen" })}>
      {({ draft }) => <WhoStep initialPerson={draft.personName} initialMe={draft.myName} />}
    </StartShell>
  );
}

function WhoStep({ initialPerson, initialMe }: { initialPerson: string; initialMe: string }) {
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
      <div className="space-y-1">
        <h1 className="text-2xl leading-snug">{t("vem.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("vem.sub")}</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader step={1} title={t("vem.s1.title")} hint={t("vem.s1.hint")} />
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <Button
              key={p.value}
              variant={personName === p.value && !customMode ? "default" : "secondary"}
              className="h-12 rounded-2xl text-sm"
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
            className="col-span-2 h-12 rounded-2xl text-sm"
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
              className="h-12 rounded-2xl text-base"
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
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
          className="h-12 rounded-2xl text-base"
        />
        <Button
          className="h-12 w-full rounded-2xl text-sm"
          disabled={personName.trim().length < 1 || myName.trim().length < 1}
          onClick={() => {
            patchDraft({ personName: personName.trim(), myName: myName.trim() });
            void navigate({ to: "/start/adress" });
          }}
        >
          {t("common.continue")} <ArrowRight className="size-4" />
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader step={3} title={t("vem.s3.title")} hint={t("vem.s3.hint")} />
        <button
          type="button"
          onClick={() => void navigate({ to: "/start/kod", search: { from: undefined } })}
          className="mx-auto flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 py-2.5 pr-4 pl-2.5 text-sm text-foreground transition-colors hover:bg-card"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-4 text-primary" />
          </span>
          {t("vem.codeBtn")}
        </button>
      </section>
    </>
  );
}

function SectionHeader({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {step}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm leading-none font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
