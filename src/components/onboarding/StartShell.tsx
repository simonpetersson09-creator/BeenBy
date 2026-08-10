import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { LanguageSwitcher } from "@/components/onboarding/LanguageSwitcher";
import { useSession } from "@/hooks/useSession";
import { ensureUser } from "@/lib/auth";
import { getDraft, type OnboardingDraft } from "@/lib/onboardingDraft";

/**
 * Shared shell for every onboarding page: makes sure a background identity
 * exists and hands the current draft to the step.
 */
export function StartShell({
  children,
}: {
  children: (ctx: { userId: string; draft: OnboardingDraft }) => React.ReactNode;
}) {
  const { user, loading } = useSession();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  useEffect(() => {
    if (loading || user) return;
    void ensureUser();
  }, [loading, user]);

  useEffect(() => {
    setDraft(getDraft());
  }, []);

  if (loading || !user || !draft) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-8">
      <div className="mb-3 flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="animate-rise-in space-y-4">{children({ userId: user.id, draft })}</div>
    </main>
  );
}
