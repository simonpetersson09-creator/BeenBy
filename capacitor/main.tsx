import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StatusBar } from "@capacitor/status-bar";

import "../src/styles.css";
import { getRouter } from "../src/router";
import { startViewportStability } from "../src/lib/viewportStability";

// Native iOS uses one safe-area strategy: StatusBar places WKWebView below the
// status bar. Mark the document before React mounts so CSS never adds that top
// inset a second time.
document.documentElement.dataset["nativeApp"] = "true";

// Run before React mounts. On a cold iOS relaunch WKWebView may restore its
// previous document offset before effects are allowed to run; correcting it
// here prevents the first rendered frame from inheriting that offset.
startViewportStability();

const router = getRouter();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

async function mountNativeApp() {
  // Enforce the same value at runtime as in capacitor.config.ts. Awaiting this
  // before React renders prevents top-positioned UI from briefly mounting in
  // the edge-to-edge WebView frame during a cold launch.
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // The static bundle can still be previewed outside the native bridge.
  }

  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void mountNativeApp();
