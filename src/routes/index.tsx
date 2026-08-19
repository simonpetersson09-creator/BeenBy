import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HomeScreen } from "@/components/HomeScreen";
import { useCircleData } from "@/hooks/useCircleData";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { ensureUser } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { getRecovery } from "@/lib/recovery";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BeenBy – keep track of family visits together" },
      {
        name: "description",
        content:
          "See the family's visits to mum or dad in a simple five-week overview, plan the next visit and log your own with one tap.",
      },
      { property: "og:title", content: "BeenBy – keep track of family visits together" },
      {
        property: "og:description",
        content:
          "A calm overview of the family's visits. Log your visit with one tap and see your siblings' updates instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const t = useT();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data, isLoading, error, refetch } = useCircleData(user?.id);
  // Start in "recovering" mode when a saved family exists, so we never
  // bounce to onboarding before the silent rejoin has been attempted.
  const [recovering, setRecovering] = useState(() =>
    typeof window === "undefined" ? false : Boolean(getRecovery()),
  );
  const [authFailed, setAuthFailed] = useState(false);
  const recoveryTried = useRef(false);

  // Zero friction: a backend identity is created silently, no signup screen.
  useEffect(() => {
    if (loading || user) return;
    void ensureUser().then((u) => {
      if (!u) setAuthFailed(true);
    });
  }, [loading, user]);

  // If the anonymous session was lost, silently rejoin the saved family
  // circle so the user never has to enter their details again.
  useEffect(() => {
    // Data is there (or just got created) – nothing to recover.
    if (data) {
      setRecovering(false);
      return;
    }
    if (loading || !user || isLoading || recoveryTried.current) return;

    const saved = getRecovery();
    if (!saved) {
      setRecovering(false);
      return;
    }
    recoveryTried.current = true;
    setRecovering(true);
    void (async () => {
      const { error: joinError } = await supabase.rpc("join_circle", {
        _name: saved.name,
        _color: saved.color,
        _code: saved.code,
      });
      if (joinError) console.error(joinError);
      await refetch();
      setRecovering(false);
    })();
  }, [loading, user, isLoading, data, refetch]);

  // No circle yet: the onboarding lives on its own pages. A failed load is
  // NOT the same as "no circle" – never bounce to onboarding on an error.
  useEffect(() => {
    if (loading || !user || isLoading || recovering || data || error) return;
    void navigate({ to: "/start/valkommen", replace: true });
  }, [loading, user, isLoading, recovering, data, error, navigate]);

  if (error || authFailed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-sm text-muted-foreground">{t("error.loadCircle")}</p>
        <Button
          onClick={() => {
            setAuthFailed(false);
            recoveryTried.current = false;
            void refetch();
          }}
        >
          {t("error.retry")}
        </Button>
        <button
          type="button"
          className="text-xs underline text-muted-foreground"
          onClick={() => void navigate({ to: "/start/kod", search: { from: undefined } })}
        >
          {t("error.enterCode")}
        </button>

      </div>
    );
  }

  if (loading || !user || isLoading || recovering || !data) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <HomeScreen data={data} userId={user.id} refresh={() => void refetch()} />;
}

