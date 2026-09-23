import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Users } from "lucide-react";

import { StartShell } from "@/components/onboarding/StartShell";
import { useRememberStep } from "@/hooks/useRememberStep";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/start/valj")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create or join a family circle – BeenBy" },
      {
        name: "description",
        content: "Create a new family circle or join an existing one with a family code.",
      },
      { property: "og:title", content: "Create or join a family circle – BeenBy" },
      {
        property: "og:description",
        content: "Create a new family circle or join an existing one with a family code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChoosePage,
});

function ChoosePage() {
  useRememberStep("/start/valj");
  const navigate = useNavigate();
  return (
    <StartShell onBack={() => void navigate({ to: "/start/valkommen" })}>
      {() => <ChooseStep />}
    </StartShell>
  );
}

function ChooseStep() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <>
      <div className="space-y-0.5 text-center">
        <h1 className="text-2xl leading-snug">{t("valj.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("valj.sub")}</p>
      </div>

      <div className="flex items-start justify-center gap-4 pt-4">
        <button
          type="button"
          onClick={() => void navigate({ to: "/start/vem" })}
          className="flex size-36 flex-col items-center justify-center gap-2.5 rounded-full bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
        >
          <Users className="size-7" strokeWidth={1.5} />
          <span className="text-center text-[0.8rem] leading-tight">{t("valj.create")}</span>
        </button>

        <button
          type="button"
          onClick={() => void navigate({ to: "/start/kod", search: { from: undefined } })}
          className="flex size-36 flex-col items-center justify-center gap-2.5 rounded-full border border-primary/40 bg-card px-4 text-foreground transition-transform active:scale-95"
        >
          <KeyRound className="size-7 text-primary" strokeWidth={1.5} />
          <span className="text-center text-[0.8rem] leading-tight">{t("valj.join")}</span>
        </button>
      </div>
    </>
  );
}
