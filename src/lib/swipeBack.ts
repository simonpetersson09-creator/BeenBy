/**
 * iOS-style edge swipe to go back.
 *
 * WKWebView only gives us the native back gesture for real page loads, and the
 * app is a single-page router, so we recognise the gesture ourselves: a touch
 * that starts near the left edge and travels mostly horizontally to the right.
 */

const EDGE_PX = 32;
const MIN_DISTANCE = 70;
const MAX_VERTICAL = 60;
const MAX_DURATION = 800;

export function startSwipeBack(onBack: () => void) {
  if (typeof window === "undefined") return () => {};

  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let tracking = false;

  const blocked = () =>
    Boolean(
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      ),
    );

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1 || blocked()) return;
    const touch = e.touches[0]!;
    if (touch.clientX > EDGE_PX) return;
    startX = touch.clientX;
    startY = touch.clientY;
    startedAt = Date.now();
    tracking = true;
  }

  function onMove(e: TouchEvent) {
    if (!tracking || e.touches.length !== 1) return;
    const touch = e.touches[0]!;
    if (Math.abs(touch.clientY - startY) > MAX_VERTICAL) tracking = false;
  }

  function onEnd(e: TouchEvent) {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    if (!touch) return;
    if (Date.now() - startedAt > MAX_DURATION) return;
    if (Math.abs(touch.clientY - startY) > MAX_VERTICAL) return;
    if (touch.clientX - startX < MIN_DISTANCE) return;
    if (blocked()) return;
    onBack();
  }

  window.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true });
  window.addEventListener("touchcancel", () => (tracking = false), { passive: true });

  return () => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
  };
}
