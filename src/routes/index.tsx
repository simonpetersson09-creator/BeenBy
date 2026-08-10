import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { HomeScreen } from "@/components/HomeScreen";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data, isLoading, refetch } = useCircleData(user?.id);
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

  // No circle yet: the onboarding lives on its own pages.
  useEffect(() => {
    if (loading || !user || isLoading || recovering || data) return;
    if (recoveryTried.current && recovering) return;
    if (getRecovery() && !recoveryTried.current) return;
    void navigate({ to: "/start/vem", replace: true });
  }, [loading, user, isLoading, recovering, data, navigate]);

  if (loading || !user || isLoading || recovering || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <HomeScreen data={data} userId={user.id} refresh={() => void refetch()} />;
}
