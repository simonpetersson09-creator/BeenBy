import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";

import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return <StartShell>{({ draft }) => <WhoStep initialPerson={draft.personName} initialMe={draft.myName} />}</StartShell>;
}

function WhoStep({ initialPerson, initialMe }: { initialPerson: string; initialMe: string }) {
  const navigate = useNavigate();
  const [personName, setPersonName] = useState(initialPerson);
  const [myName, setMyName] = useState(initialMe);
  const [customMode, setCustomMode] = useState(
    Boolean(initialPerson) && !["Mamma", "Pappa"].includes(initialPerson),
  );

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl leading-snug">Kom igång</h1>
        <p className="text-sm text-muted-foreground">Tre snabba steg – det tar under en minut.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader
          step={1}
          title="Vem vill ni hålla kontakten med?"
          hint="Välj ett alternativ, eller skriv ett eget namn."
        />
        <div className="grid grid-cols-2 gap-2">
          {["Mamma", "Pappa"].map((n) => (
            <Button
              key={n}
              variant={personName === n && !customMode ? "default" : "secondary"}
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
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader step={2} title="Vad heter du?" hint="Namnet syns för resten av familjen." />
        <Input
          id="me"
          value={myName}
          maxLength={60}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="Ditt namn"
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
          Fortsätt <ArrowRight className="size-4" />
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/25 bg-card/60 p-3">
        <SectionHeader
          step={3}
          title="Har du fått en familjekod?"
          hint="Gå med i en familj som redan finns."
        />
        <button
          type="button"
          onClick={() => void navigate({ to: "/start/kod" })}
          className="mx-auto flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 py-2.5 pr-4 pl-2.5 text-sm text-foreground transition-colors hover:bg-card"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-4 text-primary" />
          </span>
          Ange familjekod
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
