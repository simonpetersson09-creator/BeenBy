/**
 * Draft state for the multi-page onboarding flow. Each onboarding step is its
 * own route, so the answers live here (in memory + localStorage) between pages.
 */
export type OnboardingDraft = {
  personName: string;
  myName: string;
  address: string;
  resolvedAddress: string | null;
  lat: number | null;
  lng: number | null;
  color: string;
};

const KEY = "beenby.onboarding.draft";

export const emptyDraft: OnboardingDraft = {
  personName: "",
  myName: "",
  address: "",
  resolvedAddress: null,
  lat: null,
  lng: null,
  color: "blue",
};

export function getDraft(): OnboardingDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyDraft;
    return { ...emptyDraft, ...(JSON.parse(raw) as Partial<OnboardingDraft>) };
  } catch {
    return emptyDraft;
  }
}

export function patchDraft(patch: Partial<OnboardingDraft>) {
  if (typeof window === "undefined") return;
  const next = { ...getDraft(), ...patch };
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
