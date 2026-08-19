/** Fixed, accessible and clearly distinct member colors. Color = who. */
export type MemberColor = {
  id: string;
  label: string;
  hex: string;
  /** readable text color on top of hex */
  on: string;
};

/**
 * Clear, saturated tones that stay easy to tell apart on the greige
 * background — also for older eyes. Ids are stable (stored in the db).
 */
export const MEMBER_COLORS: MemberColor[] = [
  { id: "blue", label: "Blå", hex: "#1D4ED8", on: "#ffffff" },
  { id: "purple", label: "Lila", hex: "#7C3AED", on: "#ffffff" },
  { id: "green", label: "Grön", hex: "#15803D", on: "#ffffff" },
  { id: "orange", label: "Orange", hex: "#EA580C", on: "#ffffff" },
  { id: "pink", label: "Rosa", hex: "#DB2777", on: "#ffffff" },
  { id: "teal", label: "Turkos", hex: "#0D9488", on: "#ffffff" },
  { id: "amber", label: "Senap", hex: "#B45309", on: "#ffffff" },
  { id: "slate", label: "Grå", hex: "#475569", on: "#ffffff" },
];



export function colorById(id: string | undefined | null): MemberColor {
  return MEMBER_COLORS.find((c) => c.id === id) ?? MEMBER_COLORS[MEMBER_COLORS.length - 1]!;
}
