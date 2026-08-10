import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { JoinFlow } from "@/components/JoinFlow";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/join/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gå med i familjecirkeln – Nära" },
      {
        name: "description",
        content: "Du har blivit inbjuden att hålla koll på besöken tillsammans med din familj.",
      },
      { property: "og:title", content: "Gå med i familjecirkeln – Nära" },
      {
        property: "og:description",
        content: "Du har blivit inbjuden att hålla koll på besöken tillsammans med din familj.",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { next: `/join/${token}` } as never });
      return;
    }
    setReady(true);
  }, [loading, user, navigate, token]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <JoinFlow token={token} onJoined={() => navigate({ to: "/" })} />;
}
