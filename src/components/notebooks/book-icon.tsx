// Subject palette uses chart tokens so it follows the theme.
export const SUBJECT_COLORS: Record<string, string> = {
  blue: "var(--chart-1)",
  green: "var(--chart-2)",
  amber: "var(--chart-3)",
  rose: "var(--chart-4)",
  violet: "var(--chart-5)",
  slate: "var(--muted-foreground)",
};

export function BookIcon({ color, small }: { color: string; small?: boolean }) {
  const c = SUBJECT_COLORS[color] ?? SUBJECT_COLORS.blue;
  const w = small ? 28 : 52;
  return (
    <svg width={w} height={w * 1.2} viewBox="0 0 50 60" aria-hidden>
      <rect x="6" y="2" width="40" height="56" rx="4" fill={c} />
      <rect x="6" y="2" width="7" height="56" rx="2" fill="var(--foreground)" opacity="0.18" />
      <rect x="18" y="14" width="22" height="4" rx="2" fill="var(--background)" opacity="0.85" />
      <rect x="18" y="22" width="15" height="3" rx="1.5" fill="var(--background)" opacity="0.6" />
      <rect x="44" y="6" width="4" height="48" rx="1" fill="var(--background)" opacity="0.7" />
    </svg>
  );
}

export function masteryColor(m: number | null) {
  if (m == null) return "text-muted-foreground";
  if (m >= 80) return "text-chart-2";
  if (m >= 50) return "text-chart-3";
  return "text-destructive";
}
