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
  // innerHeight is the stable layout viewport. visualViewport.height can be
  // restored with a stale offset/keyboard value by WKWebView after resume,
  // which previously made every h-dvh screen too short and appear shifted.
  const h = window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
}

/**
 * Radix locks body interaction while a modal is open. WKWebView can suspend in
 * the middle of its close animation and preserve that inline lock even though
 * the portal is gone, making the whole app look tappable while swallowing taps.
 */
function repairInteractionLock() {
  const modalOpen = document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  );
  if (modalOpen) return;
  document.body.style.removeProperty("pointer-events");
  document.body.removeAttribute("data-scroll-locked");
}

function stabilise() {
  resetViewport();
  syncHeight();
  repairInteractionLock();
  // A second pass after the browser has settled its own restore work.
  requestAnimationFrame(() => {
    resetViewport();
    syncHeight();
    repairInteractionLock();
  });
  window.setTimeout(() => {
    resetViewport();
    syncHeight();
    repairInteractionLock();
    window.dispatchEvent(new Event("beenby:resume"));
  }, 250);
}

/** Starts the listeners. Returns a cleanup function. */
export function startViewportStability(): () => void {
  if (typeof window === "undefined") return () => {};

  // The Capacitor entry starts this before React mounts. RootComponent also
  // starts it for the web build, so guard against duplicated listeners.
  if (document.documentElement.dataset.viewportStability === "active") return () => {};
  document.documentElement.dataset.viewportStability = "active";

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  const onVisibility = () => {
    if (document.visibilityState === "visible") stabilise();
  };

  let removeNativeListener: (() => void) | undefined;
  void import("@capacitor/app")
    .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) stabilise();
    }))
    .then((handle) => {
      removeNativeListener = () => void handle.remove();
    })
    .catch(() => {
      // Browser builds do not need the native lifecycle event.
    });

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
    removeNativeListener?.();
    delete document.documentElement.dataset.viewportStability;
  };
}
