import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

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
        <h1 className="text-2xl leading-snug">Vem vill ni hålla kontakten med?</h1>
        <p className="text-sm text-muted-foreground">Välj ett alternativ, eller skriv ett eget namn.</p>
      </div>
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
        onClick={() => {
          patchDraft({ personName: personName.trim(), myName: myName.trim() });
          void navigate({ to: "/start/adress" });
        }}
      >
        Fortsätt <ArrowRight className="size-4" />
      </Button>
      <button
        type="button"
        className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => void navigate({ to: "/start/kod" })}
      >
        Har du fått en familjekod?
      </button>
    </>
  );
}
