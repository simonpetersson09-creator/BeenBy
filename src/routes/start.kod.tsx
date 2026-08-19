import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { JoinFlow } from "@/components/JoinFlow";
import { StartShell } from "@/components/onboarding/StartShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { getDraft, patchDraft } from "@/lib/onboardingDraft";

export const Route = createFileRoute("/start/kod")({
  ssr: false,
  // "from=app" means the user came from Settings inside the app, so cancelling
  // should return to the app — not back into onboarding.
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "app" ? ("app" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Enter family code – BeenBy" },
      {
        name: "description",
        content: "Got a family code? Enter it here to join the family's visit overview.",
      },
      { property: "og:title", content: "Enter family code – BeenBy" },
      {
        property: "og:description",
        content: "Join the family with the code you got from a sibling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CodePage,
});

function CodePage() {
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const backTo = from === "app" ? "/" : "/start/vem";
  const t = useT();
  const [code, setCode] = useState(() => getDraft().familyCode);
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
    <StartShell onBack={() => void navigate({ to: backTo })}>
      {() => (
        <>
          <h1 className="text-2xl leading-snug">{t("kod.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("kod.sub")}
          </p>
          <Input
            value={code}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              setCode(next);
              patchDraft({ familyCode: next });
            }}
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
            onClick={() => void navigate({ to: backTo })}
          >
            {t("common.back")}
          </button>
        </>
      )}
    </StartShell>
  );
}
