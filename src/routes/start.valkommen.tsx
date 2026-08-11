import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BellRing, CalendarHeart, Hand, History } from "lucide-react";

import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/start/valkommen")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Har någon varit hos mamma eller pappa? – BeenBy" },
      {
        name: "description",
        content:
          "BeenBy hjälper familjen att hålla koll på besöken hos mamma eller pappa – se senaste besöket, planerade besök och registrera med ett tryck.",
      },
      { property: "og:title", content: "BeenBy – håll koll på besöken tillsammans" },
      {
        property: "og:description",
        content: "Se när någon senast hälsade på, vem som planerar besök och registrera med ett tryck.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});

const points = [
  { icon: History, key: "welcome.p1" },
  { icon: CalendarHeart, key: "welcome.p2" },
  { icon: Hand, key: "welcome.p3" },
  { icon: BellRing, key: "welcome.p4" },
];

const HINT_KEY = "beenby.langHintSeen";

function WelcomePage() {
  const navigate = useNavigate();
  const t = useT();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(HINT_KEY)) return;
    const timer = window.setTimeout(() => setShowHint(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  function dismissHint() {
    window.localStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col justify-center gap-5 overflow-hidden px-6 py-8">
      <div className="animate-rise-in space-y-3">
        <h1 className="text-3xl leading-tight text-primary">{t("welcome.title")}</h1>
        <p className="text-base text-muted-foreground">{t("welcome.sub")}</p>
      </div>

      <ul className="animate-rise-in divide-y divide-primary/10">
        {points.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 py-3">
            <Icon className="mt-0.5 size-4.5 shrink-0 text-primary/70" strokeWidth={1.5} />
            <span className="text-sm leading-relaxed text-foreground/90">{t(key)}</span>
          </li>
        ))}
      </ul>

      <div className="relative flex items-center gap-2">
        {showHint ? (
          <button
            type="button"
            onClick={dismissHint}
            className="animate-rise-in absolute right-0 bottom-full z-20 mb-3 flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs text-primary-foreground shadow-lg"
          >
            {t("lang.hint")}
            <span className="absolute top-full right-5 -mt-1 size-2.5 rotate-45 rounded-[2px] bg-primary" />
          </button>
        ) : null}
        <Button
          className="h-12 flex-1 rounded-2xl text-sm"
          onClick={() => void navigate({ to: "/start/vem" })}
        >
          {t("welcome.cta")} <ArrowRight className="size-4" />
        </Button>
        <span onClick={dismissHint}>
          <LanguageSwitcher round />
        </span>
      </div>
    </main>
  );
}
