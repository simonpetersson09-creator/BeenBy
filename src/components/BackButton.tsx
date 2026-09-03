import { ArrowLeft } from "lucide-react";

import { useT } from "@/lib/i18n";

/**
 * Round back button, fixed in the top-left corner of a page.
 * Fixed to the app viewport; Capacitor keeps that viewport below the iOS
 * status bar and browser/PWA safe area is owned by the root layout.
 */
export function BackButton({ onClick, inline }: { onClick: () => void; inline?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t("common.back")}
      onClick={onClick}
      className={
        inline
          ? "flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          : "fixed left-4 top-4 z-40 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      }
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
