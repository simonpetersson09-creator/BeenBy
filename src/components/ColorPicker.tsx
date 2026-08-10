import { Check } from "lucide-react";

import { MEMBER_COLORS } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  taken = [],
}: {
  value: string | null;
  onChange: (id: string) => void;
  taken?: string[];
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {MEMBER_COLORS.map((c) => {
        const isTaken = taken.includes(c.id) && c.id !== value;
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(c.id)}
            aria-pressed={selected}
            aria-label={`${c.label}${isTaken ? " (upptagen)" : ""}`}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl p-2 transition",
              isTaken ? "cursor-not-allowed opacity-35" : "hover:bg-secondary",
              selected && "bg-secondary",
            )}
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full transition",
                selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: c.hex }}
            >
              {selected ? <Check className="size-5" style={{ color: c.on }} strokeWidth={3} /> : null}
            </span>
            <span className="text-xs text-muted-foreground">{isTaken ? "Upptagen" : c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
