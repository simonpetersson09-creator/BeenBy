/**
 * Turns raw backend errors into calm, everyday wording.
 * Everything falls back to the caller's own message, so no screen ever shows
 * a technical code to the user.
 */
type Translate = (key: string, vars?: Record<string, string>) => string;

type MaybeError = { message?: string; code?: string; status?: number } | null | undefined;

export function friendlyError(error: MaybeError, t: Translate, fallbackKey?: string): string {
  const message = (error?.message ?? "").toLowerCase();
  const code = error?.code ?? "";
  const status = error?.status ?? 0;

  const offline =
    typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false;

  if (offline || message.includes("failed to fetch") || message.includes("network")) {
    return t("err.offline");
  }
  if (status === 429 || message.includes("rate limit") || message.includes("too many")) {
    return t("err.tooFast");
  }
  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission")
  ) {
    return t("err.notAllowed");
  }
  return fallbackKey ? t(fallbackKey) : t("err.generic");
}
