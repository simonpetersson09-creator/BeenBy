/**
 * Android system back (button or gesture).
 *
 * Without a listener Capacitor would close the app on every back press. Order:
 * close an open dialog → go back in the app → otherwise minimise (like other
 * Android apps). Does nothing on iOS or in the browser.
 */
export function startAndroidBackButton(goBack: () => boolean): () => void {
  if (typeof window === "undefined") return () => {};
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } })
    .Capacitor;
  if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== "android") return () => {};

  let remove: (() => void) | undefined;
  let cancelled = false;
  void import("@capacitor/app").then(async ({ App }) => {
    const handle = await App.addListener("backButton", () => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
      if (dialog) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return;
      }
      if (!goBack()) void App.minimizeApp();
    });
    if (cancelled) void handle.remove();
    else remove = () => void handle.remove();
  });
  return () => {
    cancelled = true;
    remove?.();
  };
}
