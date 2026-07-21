// Presentation helpers for playbook concepts (stages, lanes) shared across routes.

export const LANE_LABELS: Record<string, string> = {
  happy_path: "Happy Path",
  recommended: "Recommended",
  as_needed: "As Needed",
};

export const LANE_ORDER = ["happy_path", "recommended", "as_needed"];

// Tailwind classes for lane accents — muted, professional tones that harmonize
// with the indigo theme (600-weight reads calmer than the saturated 500s).
export const LANE_ACCENT: Record<string, string> = {
  happy_path: "border-l-emerald-600",
  recommended: "border-l-indigo-500",
  as_needed: "border-l-amber-600",
};

export const LANE_DOT: Record<string, string> = {
  happy_path: "bg-emerald-600",
  recommended: "bg-indigo-500",
  as_needed: "bg-amber-600",
};

// A short, stable label lookup for stage codes when only the key is on hand.
export function progressTone(pct: number): string {
  if (pct >= 80) return "text-emerald-700 dark:text-emerald-400";
  if (pct >= 40) return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}
