import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { HomeScreen } from "@/components/HomeScreen";
import { JoinFlow } from "@/components/JoinFlow";
import { Onboarding } from "@/components/Onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircleData } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { ensureUser } from "@/lib/auth";
import { getRecovery } from "@/lib/recovery";

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
  const [recovering, setRecovering] = useState(false);
  const recoveryTried = useRef(false);

  // Zero friction: a backend identity is created silently, no signup screen.
  useEffect(() => {
    if (loading || user) return;
    void ensureUser();
  }, [loading, user]);

  // If the anonymous session was lost, silently rejoin the saved family
  // circle so the user never has to enter their details again.
  useEffect(() => {
    if (loading || !user || isLoading || data || recoveryTried.current) return;
    const saved = getRecovery();
    if (!saved) return;
    recoveryTried.current = true;
    setRecovering(true);
    void (async () => {
      const { error } = await supabase.rpc("join_circle", {
        _name: saved.name,
        _color: saved.color,
        _code: saved.code,
      });
      if (error) console.error(error);
      await refetch();
      setRecovering(false);
    })();
  }, [loading, user, isLoading, data, refetch]);

  if (loading || !user || isLoading || recovering) {
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
