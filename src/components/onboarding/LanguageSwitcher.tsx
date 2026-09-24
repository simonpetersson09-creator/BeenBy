import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";

import { LANGUAGES, setLang, useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Max rows visible before the list scrolls internally. */
const VISIBLE_ROWS = 5;

/**
 * Compact language picker. Opens a scrollable list showing only a few
 * languages at a time, anchored with fixed positioning so it never gets
 * clipped by scrolling parents or runs off the screen.
 */
export function LanguageSwitcher({
  className,
  round = false,
}: {
  className?: string;
  round?: boolean;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  // Position the list with fixed coordinates so overflow-hidden/scroll
  // containers can't clip it; flip above the button when near the bottom.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const listH = listRef.current?.offsetHeight ?? 0;
    const gap = 8;
    const margin = 12;
    const openUp = rect.bottom + gap + listH > window.innerHeight - margin;
    const left = Math.min(
      Math.max(margin, rect.right - 208),
      window.innerWidth - 208 - margin,
    );
    setStyle(
      openUp
        ? { left, bottom: window.innerHeight - rect.top + gap }
        : { left, top: rect.bottom + gap },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll the current language into view when the list opens.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-current='true']");
    el?.scrollIntoView({ block: "center" });
  }, [open]);

  const pick = (code: Lang) => {
    setLang(code);
    setOpen(false);
  };

  const list = (
    <div
      ref={listRef}
      style={{ ...style, position: "fixed" }}
      className="animate-rise-in z-50 w-52 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-lg"
    >
      <div
        className="max-h-[calc(var(--lb-rows)*2.5rem)] overflow-y-auto overscroll-contain"
        style={{ ["--lb-rows" as string]: VISIBLE_ROWS }}
      >
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            data-current={l.code === lang}
            onClick={() => pick(l.code)}
            className={cn(
              "flex h-10 w-full items-center gap-2 px-3 text-left text-sm",
              l.code === lang
                ? "bg-primary/10 font-medium text-primary"
                : "text-foreground/90 active:bg-primary/5",
            )}
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span className="flex-1 truncate">{l.label}</span>
            {l.code === lang ? <Check className="size-4 shrink-0 text-primary" /> : null}
          </button>
        ))}
      </div>
    </div>
  );

  if (round) {
    return (
      <>
        <button
          ref={btnRef}
          type="button"
          aria-label={current.label}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "relative flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-card/70 text-lg",
            className,
          )}
        >
          <span className="pointer-events-none leading-none">{current.flag}</span>
        </button>
        {open ? list : null}
      </>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={current.label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card/70 py-1.5 pr-2.5 pl-3 text-xs text-foreground",
          className,
        )}
      >
        <Globe className="size-3.5 shrink-0 text-primary" />
        <span className="pointer-events-none">
          {current.flag} {current.label}
        </span>
      </button>
      {open ? list : null}
    </>
  );
}
