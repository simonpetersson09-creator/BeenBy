import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { HomeScreen } from "@/components/HomeScreen";
import { JoinFlow } from "@/components/JoinFlow";
import { Onboarding } from "@/components/Onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircleData } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { ensureUser } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nära – håll koll på besöken tillsammans" },
      {
        name: "description",
        content:
          "Se familjens besök hos mamma eller pappa i en enkel 28-dagarsvy, planera nästa besök och registrera ditt eget med ett tryck.",
      },
      { property: "og:title", content: "Nära – håll koll på besöken tillsammans" },
      {
        property: "og:description",
        content:
          "En lugn översikt över familjens besök. Registrera ditt besök med ett tryck och se syskonens uppdateringar direkt.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useSession();
  const { data, isLoading, refetch } = useCircleData(user?.id);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);

  // Zero friction: a backend identity is created silently, no signup screen.
  useEffect(() => {
    if (loading || user) return;
    void ensureUser();
  }, [loading, user]);

  if (loading || !user || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeCode) {
    return (
      <JoinFlow
        code={activeCode}
        onJoined={() => {
          setActiveCode(null);
          void refetch();
        }}
        onCancel={() => setActiveCode(null)}
      />
    );
  }

  if (!data) {
    if (codeMode) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-6">
          <h1 className="text-3xl">Ange familjekod</h1>
          <p className="text-muted-foreground">Koden får du av den som redan använder appen.</p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={10}
            className="h-14 rounded-2xl text-center text-2xl tracking-widest"
          />
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base"
            disabled={code.trim().length < 4}
            onClick={() => setActiveCode(code.trim())}
          >
            Gå med
          </Button>
          <Button variant="ghost" onClick={() => setCodeMode(false)}>
            Tillbaka
          </Button>
        </main>
      );
    }

    return (
      <>
        <Onboarding userId={user.id} onDone={() => void refetch()} />
        <div className="fixed inset-x-0 bottom-6 flex justify-center">
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setCodeMode(true)}
          >
            Har du fått en familjekod?
          </button>
        </div>
      </>
    );
  }

  return <HomeScreen data={data} userId={user.id} refresh={() => void refetch()} />;
}
