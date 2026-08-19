/**
 * Optional activity chips shown in the "Jag är här" and "Planera besök"
 * dialogs. Nothing is required — the visit can always be saved with an empty
 * selection, so the fast flow stays exactly as fast as before.
 */
import { Input } from "@/components/ui/input";
import { ACTIVITIES, type ActivityId } from "@/lib/activities";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ActivityPicker({
  selected,
  onChange,
  note,
  onNoteChange,
  compact,
}: {
  selected: ActivityId[];
  onChange: (next: ActivityId[]) => void;
  note: string;
  onNoteChange: (next: string) => void;
  compact?: boolean;
}) {
  const t = useT();

  function toggle(id: ActivityId) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
    if (id === "other" && !next.includes("other")) onNoteChange("");
  }

  return (
    <div className={cn("rounded-2xl border border-primary/25", compact ? "px-2.5 py-2" : "px-3 py-3")}>
      <p className={cn("font-medium uppercase tracking-[0.18em] text-primary/60", compact ? "text-[0.6rem]" : "text-[0.62rem]")}>
        {t("act.title")}
      </p>
      <p className={cn("text-muted-foreground", compact ? "text-[0.6rem]" : "mt-0.5 text-[0.68rem]")}>{t("act.optional")}</p>
      <div className={cn("flex flex-wrap", compact ? "mt-1.5 gap-1" : "mt-2.5 gap-1.5")}>
        {ACTIVITIES.map((a) => {
          const on = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(a.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border transition-colors",
                compact ? "px-2 py-1 text-[0.7rem]" : "px-3 py-1.5 text-xs",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-soft"
                  : "border-primary/25 bg-secondary/60 text-foreground hover:bg-accent",
              )}
            >
              <span aria-hidden>{a.emoji}</span>
              {t(a.key)}
            </button>
          );
        })}
      </div>
      {selected.includes("other") ? (
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value.slice(0, 60))}
          placeholder={t("act.otherPlaceholder")}
          className={cn("rounded-2xl", compact ? "mt-1.5 h-9" : "mt-2.5 h-11")}
        />
      ) : null}
    </div>
  );
}
