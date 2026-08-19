/** Fixed, accessible and clearly distinct member colors. Color = who. */
export type MemberColor = {
  id: string;
  label: string;
  hex: string;
  /** English base name; the UI shows the translated `color.<id>` string. */
  /** readable text color on top of hex */
  on: string;
};

/**
 * Clear, saturated tones that stay easy to tell apart on the greige
 * background — also for older eyes. Ids are stable (stored in the db).
 */
export const MEMBER_COLORS: MemberColor[] = [
  { id: "blue", label: "Blue", hex: "#1D4ED8", on: "#ffffff" },
  { id: "purple", label: "Purple", hex: "#7C3AED", on: "#ffffff" },
  { id: "green", label: "Green", hex: "#15803D", on: "#ffffff" },
  { id: "orange", label: "Orange", hex: "#EA580C", on: "#ffffff" },
  { id: "pink", label: "Pink", hex: "#DB2777", on: "#ffffff" },
  { id: "teal", label: "Teal", hex: "#0D9488", on: "#ffffff" },
  { id: "amber", label: "Mustard", hex: "#B45309", on: "#ffffff" },
  { id: "slate", label: "Grey", hex: "#475569", on: "#ffffff" },
];



export function colorById(id: string | undefined | null): MemberColor {
  return MEMBER_COLORS.find((c) => c.id === id) ?? MEMBER_COLORS[MEMBER_COLORS.length - 1]!;
}
