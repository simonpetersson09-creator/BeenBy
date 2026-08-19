/**
 * iOS/WKWebView viewport stabiliser.
 *
 * When the app is backgrounded and resumed, WebKit can restore the window with
 * a non-zero scroll offset (and a stale visual-viewport offset). Because the
 * app layout is fixed height (h-dvh) with its own inner scroll containers, that
 * offset shifts every page upwards – back buttons end up behind the status bar
 * and become untappable.
 *
 * This resets the document/visual viewport back to the top whenever the app
 * becomes visible again, and keeps a --app-height variable in sync so that
 * full-height layouts always match the real visible area.
 */

function keyboardOpen() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function resetViewport() {
  if (keyboardOpen()) return;
  const doc = document.scrollingElement ?? document.documentElement;
  if (doc.scrollTop !== 0) doc.scrollTop = 0;
  if (doc.scrollLeft !== 0) doc.scrollLeft = 0;
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  document.body.scrollTop = 0;
}

function syncHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
}

function stabilise() {
  resetViewport();
  syncHeight();
  // A second pass after the browser has settled its own restore work.
  requestAnimationFrame(() => {
    resetViewport();
    syncHeight();
  });
  window.setTimeout(() => {
    resetViewport();
    syncHeight();
  }, 250);
}

/** Starts the listeners. Returns a cleanup function. */
export function startViewportStability(): () => void {
  if (typeof window === "undefined") return () => {};

  const onVisibility = () => {
    if (document.visibilityState === "visible") stabilise();
  };

  stabilise();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", stabilise);
  window.addEventListener("focus", stabilise);
  window.addEventListener("orientationchange", stabilise);
  window.visualViewport?.addEventListener("resize", syncHeight);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pageshow", stabilise);
    window.removeEventListener("focus", stabilise);
    window.removeEventListener("orientationchange", stabilise);
    window.visualViewport?.removeEventListener("resize", syncHeight);
  };
}
