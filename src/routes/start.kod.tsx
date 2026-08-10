import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { JoinFlow } from "@/components/JoinFlow";
import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/start/kod")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ange familjekod – Nära" },
      {
        name: "description",
        content: "Har du fått en familjekod? Ange den här för att gå med i familjens besöksöversikt.",
      },
      { property: "og:title", content: "Ange familjekod – Nära" },
      {
        property: "og:description",
        content: "Gå med i familjen med koden du fått av ett syskon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CodePage,
});

function CodePage() {
  const navigate = useNavigate();
  const t = useT();
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);

  if (activeCode) {
    return (
      <JoinFlow
        code={activeCode}
        onJoined={() => void navigate({ to: "/" })}
        onCancel={() => setActiveCode(null)}
      />
    );
  }

  return (
    <StartShell>
      {() => (
        <>
          <h1 className="text-2xl leading-snug">{t("kod.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("kod.sub")}
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={10}
            className="h-14 rounded-2xl text-center text-2xl tracking-widest"
          />
          <Button
            className="h-12 w-full rounded-2xl text-sm"
            disabled={code.trim().length < 4}
            onClick={() => setActiveCode(code.trim())}
          >
            {t("kod.join")}
          </Button>
          <button
            type="button"
            className="mx-auto block text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => void navigate({ to: "/start/vem" })}
          >
            {t("common.back")}
          </button>
        </>
      )}
    </StartShell>
  );
}
