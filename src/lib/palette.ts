/** Fixed, accessible and clearly distinct member colors. Color = who. */
export type MemberColor = {
  id: string;
  label: string;
  hex: string;
  /** readable text color on top of hex */
  on: string;
};

/**
 * Muted, warm-leaning tones tuned to sit calmly on the greige background
 * next to the marine blue brand color. Ids are stable (stored in the db).
 */
export const MEMBER_COLORS: MemberColor[] = [
  { id: "blue", label: "Blå", hex: "#2F5D7C", on: "#ffffff" },
  { id: "purple", label: "Lila", hex: "#6B5B8A", on: "#ffffff" },
  { id: "green", label: "Grön", hex: "#4F7A5B", on: "#ffffff" },
  { id: "orange", label: "Terrakotta", hex: "#B5713F", on: "#ffffff" },
  { id: "pink", label: "Rosa", hex: "#A85F6B", on: "#ffffff" },
  { id: "teal", label: "Turkos", hex: "#3F7B78", on: "#ffffff" },
  { id: "amber", label: "Senap", hex: "#A98A3C", on: "#ffffff" },
  { id: "slate", label: "Grå", hex: "#6B6A66", on: "#ffffff" },
];


export function colorById(id: string | undefined | null): MemberColor {
  return MEMBER_COLORS.find((c) => c.id === id) ?? MEMBER_COLORS[MEMBER_COLORS.length - 1]!;
}
