import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BellRing, CalendarHeart, Hand, History } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  { icon: History, text: "Se när någon senast hälsade på" },
  { icon: CalendarHeart, text: "Se vem som tänker hälsa på och när" },
  { icon: Hand, text: "Registrera med ett tryck" },
  { icon: BellRing, text: "BeenBy kan påminna dig när du är på plats" },
];

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="animate-rise-in space-y-3">
        <h1 className="text-3xl leading-tight text-primary">
          Har någon varit hos mamma eller pappa? ❤️
        </h1>
        <p className="text-base text-muted-foreground">
          BeenBy hjälper familjen att hålla koll på besöken.
        </p>
      </div>

      <ul className="animate-rise-in space-y-2.5">
        {points.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/60 px-3.5 py-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon className="size-4.5 text-primary" strokeWidth={1.75} />
            </span>
            <span className="text-sm text-foreground">{text}</span>
          </li>
        ))}
      </ul>

      <Button
        className="h-12 w-full rounded-2xl text-sm"
        onClick={() => void navigate({ to: "/start/vem" })}
      >
        Kom igång <ArrowRight className="size-4" />
      </Button>
    </main>
  );
}
