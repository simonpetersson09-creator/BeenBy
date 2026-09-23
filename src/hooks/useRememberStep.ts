import { useEffect } from "react";

import { rememberStep, type OnboardingStep } from "@/lib/onboardingDraft";

/**
 * Remembers the onboarding page the user is on, so a reload (new preview
 * build, app restart) resumes here instead of starting over from the top.
 * Pass enabled=false when the page is opened in edit mode from inside the app.
 */
export function useRememberStep(step: OnboardingStep, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    rememberStep(step);
  }, [step, enabled]);
}
