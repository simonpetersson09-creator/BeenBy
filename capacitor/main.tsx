import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "../src/styles.css";
import { getRouter } from "../src/router";
import { startViewportStability } from "../src/lib/viewportStability";

// Marks the locally packaged Capacitor app before React mounts. Some iOS
// WKWebView versions report env(safe-area-inset-top) as 0 even though the
// webview extends under the status bar; CSS uses this marker for a safe native
// fallback without adding iPhone spacing to the ordinary web app.
document.documentElement.dataset["nativeApp"] = "true";

// Run before React mounts. On a cold iOS relaunch WKWebView may restore its
// previous document offset before effects are allowed to run; correcting it
// here prevents the first rendered frame from inheriting that offset.
startViewportStability();

const router = getRouter();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
