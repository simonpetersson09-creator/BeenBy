import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – Nära" },
      {
        name: "description",
        content:
          "Logga in för att se familjens besök hos din förälder och registrera dina egna besök.",
      },
      { property: "og:title", content: "Logga in – Nära" },
      {
        property: "og:description",
        content: "Logga in för att se familjens besök och registrera dina egna.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null;
  const safeNext = next && next.startsWith("/") ? next : "/";

  async function social(provider: "apple" | "google") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Inloggningen gick inte att slutföra. Försök igen.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: safeNext });
  }

  async function withEmail() {
    if (!email.trim() || password.length < 6) return;
    setBusy(true);
    const signIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!signIn.error) {
      setBusy(false);
      navigate({ to: safeNext });
      return;
    }
    const signUp = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (signUp.error) {
      toast.error(
        signUp.error.message.toLowerCase().includes("password")
          ? "Välj ett lite starkare lösenord (minst 6 tecken)."
          : "Kontrollera e-postadressen och lösenordet.",
      );
      return;
    }
    if (signUp.data.session) {
      navigate({ to: safeNext });
    } else {
      toast.message("Kolla din e-post", { description: "Bekräfta adressen så är du inne." });
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-4xl">Nära</h1>
        <p className="text-muted-foreground">
          Ni hjälps åt att hålla koll på besöken hos den ni bryr er om.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base"
          disabled={busy}
          onClick={() => social("apple")}
        >
          Fortsätt med Apple
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 w-full rounded-2xl text-base"
          disabled={busy}
          onClick={() => social("google")}
        >
          Fortsätt med Google
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> eller med e-post <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-2xl text-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Lösenord</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-2xl text-lg"
          />
        </div>
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base"
          disabled={busy || !email.trim() || password.length < 6}
          onClick={withEmail}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Fortsätt
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Har du inget konto skapas det automatiskt.
        </p>
      </div>
    </main>
  );
}
