import { Globe } from "lucide-react";

import { LANGUAGES, setLang, useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Compact pill for switching language during onboarding. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const lang = useLang();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card/70 py-1.5 pr-2.5 pl-3 text-xs text-foreground",
        className,
      )}
    >
      <Globe className="size-3.5 shrink-0 text-primary" />
      <span className="pointer-events-none">
        {current.flag} {current.label}
      </span>
      <select
        aria-label={current.label}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
