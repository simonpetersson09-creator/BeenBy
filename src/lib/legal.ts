/**
 * Legal links shown in Settings.
 * Fill these in when the final URLs are ready — empty string hides nothing,
 * the button just tells the user the link is coming.
 */
export const PRIVACY_POLICY_URL = "https://beenby-terms-hub.lovable.app";
export const TERMS_URL = "https://beenby-terms-hub.lovable.app";

export function openExternal(url: string) {
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
