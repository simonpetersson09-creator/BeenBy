/**
 * Draft state for the multi-page onboarding flow. Each onboarding step is its
 * own route, so the answers live here (in memory + localStorage) between pages.
 */
export type OnboardingStep =
  | "/start/valkommen"
  | "/start/valj"
  | "/start/vem"
  | "/start/adress"
  | "/start/farg"
  | "/start/kod";

export type OnboardingDraft = {
  /** Last onboarding page the user saw, so a reload resumes where they were. */
  step: OnboardingStep;
  personName: string;
  myName: string;
  address: string;
  resolvedAddress: string | null;
  lat: number | null;
  lng: number | null;
  visitNotifications: boolean;
  color: string;
  familyCode: string;
};

const KEY = "beenby.onboarding.draft";

export const emptyDraft: OnboardingDraft = {
  step: "/start/valkommen",
  personName: "",
  myName: "",
  address: "",
  resolvedAddress: null,
  lat: null,
  lng: null,
  visitNotifications: false,
  color: "blue",
  familyCode: "",
};

/**
 * In-memory mirror so the draft survives even when localStorage is blocked
 * (private mode, partitioned storage inside the preview iframe, ...).
 */
let memoryDraft: OnboardingDraft | null = null;

export function getDraft(): OnboardingDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const stored = { ...emptyDraft, ...(JSON.parse(raw) as Partial<OnboardingDraft>) };
      memoryDraft = stored;
      return stored;
    }
  } catch {
    // ignore – fall back to the in-memory draft below
  }
  return memoryDraft ?? emptyDraft;
}

export function patchDraft(patch: Partial<OnboardingDraft>) {
  if (typeof window === "undefined") return;
  const next = { ...getDraft(), ...patch };
  memoryDraft = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable – the in-memory draft keeps the flow going
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  memoryDraft = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Remember the current onboarding page so a reload resumes here. */
export function rememberStep(step: OnboardingStep) {
  patchDraft({ step });
}
