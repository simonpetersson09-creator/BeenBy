/** Fixed, accessible and clearly distinct member colors. Color = who. */
export type MemberColor = {
  id: string;
  label: string;
  hex: string;
  /** readable text color on top of hex */
  on: string;
};

export const MEMBER_COLORS: MemberColor[] = [
  { id: "blue", label: "Blå", hex: "#2563eb", on: "#ffffff" },
  { id: "purple", label: "Lila", hex: "#7c3aed", on: "#ffffff" },
  { id: "green", label: "Grön", hex: "#15803d", on: "#ffffff" },
  { id: "orange", label: "Orange", hex: "#c2410c", on: "#ffffff" },
  { id: "pink", label: "Rosa", hex: "#be185d", on: "#ffffff" },
  { id: "teal", label: "Turkos", hex: "#0f766e", on: "#ffffff" },
  { id: "amber", label: "Gul", hex: "#a16207", on: "#ffffff" },
  { id: "slate", label: "Grå", hex: "#475569", on: "#ffffff" },
];

export function colorById(id: string | undefined | null): MemberColor {
  return MEMBER_COLORS.find((c) => c.id === id) ?? MEMBER_COLORS[MEMBER_COLORS.length - 1]!;
}
