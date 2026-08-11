/**
 * Platform-aware sharing helpers.
 *
 * Native (Capacitor iOS): @capacitor/share, @capacitor/clipboard and
 * App.openUrl() — window.open("_blank") is unreliable in WKWebView and does
 * nothing at all for custom schemes such as fb-messenger://.
 *
 * Web: navigator.share / navigator.clipboard / window.location.
 *
 * We deliberately do NOT use canOpenURL, so no LSApplicationQueriesSchemes
 * entries are required in Info.plist. App.openUrl() reports {completed:false}
 * when the target app is missing, and we fall back to the native share sheet.
 */

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Native share sheet (iOS) or Web Share API; falls back to clipboard. */
export async function shareLink(options: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied"> {
  const { title, text, url } = options;

  if (isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: title });
      return "shared";
    } catch {
      /* cancelled or unavailable — fall through */
    }
  } else if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      /* cancelled — fall through */
    }
  }

  await copyText(url);
  return "copied";
}

/** Copies text using the native clipboard plugin when available. */
export async function copyText(text: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Clipboard } = await import("@capacitor/clipboard");
      await Clipboard.write({ string: text });
      return;
    } catch {
      /* fall through to web clipboard */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Last-resort fallback for older webviews.
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

/**
 * Opens an external URL (https, sms:, mailto:, fb-messenger:).
 * Returns false when the target could not be opened, so the caller can
 * fall back instead of leaving a silent dead end.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { App } = await import("@capacitor/app");
      const result = await App.openUrl({ url });
      return result?.completed !== false;
    } catch {
      return false;
    }
  }

  if (typeof window === "undefined") return false;
  const isHttp = /^https?:/i.test(url);
  if (isHttp) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = url;
  }
  return true;
}

/**
 * Tries to open a target app, and falls back to the share sheet when the app
 * is not installed or the URL cannot be handled.
 */
export async function openAppOrShare(
  url: string,
  share: { title: string; text: string; url: string },
): Promise<"opened" | "shared" | "copied"> {
  const opened = await openExternalUrl(url);
  if (opened) return "opened";
  return await shareLink(share);
}

export function smsUrl(body: string): string {
  // iOS accepts sms:&body=... ; the "&" separator is required after "sms:".
  return `sms:&body=${encodeURIComponent(body)}`;
}

export function mailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function messengerUrl(link: string): string {
  return `fb-messenger://share?link=${encodeURIComponent(link)}`;
}
