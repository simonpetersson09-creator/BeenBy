import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { JoinFlow } from "@/components/JoinFlow";
import { useSession } from "@/hooks/useSession";
import { ensureUser } from "@/lib/auth";

export const Route = createFileRoute("/join/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join the family circle – BeenBy" },
      {
        name: "description",
        content: "You have been invited to keep track of visits together with your family.",
      },
      { property: "og:title", content: "Join the family circle – BeenBy" },
      {
        property: "og:description",
        content: "You have been invited to keep track of visits together with your family.",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  // No signup wall: the invited person gets a backend identity in the background.
  useEffect(() => {
    if (loading || user) return;
    void ensureUser();
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <JoinFlow token={token} onJoined={() => navigate({ to: "/" })} />;
}
