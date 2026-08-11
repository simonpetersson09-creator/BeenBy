import { ArrowLeft } from "lucide-react";

import { useT } from "@/lib/i18n";

/**
 * Round back button, fixed in the top-left corner of a page.
 * Sits above the safe area on iOS.
 */
export function BackButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t("common.back")}
      onClick={onClick}
      className="fixed left-4 z-40 flex size-10 items-center justify-center rounded-full border border-primary/15 bg-secondary/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-secondary"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
