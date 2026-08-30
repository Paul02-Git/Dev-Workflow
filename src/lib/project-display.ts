// Shared display constants for anything that renders a project summary —
// the card grid, the list table, and the kanban board all need the exact
// same status/priority colors and progress bands, so this is the one place
// that defines them.

export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#eef2fb] text-[#2a4d8f]" },
  ON_HOLD: { label: "On Hold", className: "bg-[#fef4de] text-[#8a5c00]" },
  LAUNCHED: { label: "Launched", className: "bg-[#eafaea] text-[#0ca30c]" },
  ARCHIVED: { label: "Archived", className: "bg-black/5 text-muted-foreground" },
};

export const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#c9720a",
  MEDIUM: "#2a78d6",
  LOW: "#898781",
};

export const PROJECT_COLOR_PALETTE = ["#2a78d6", "#0ca30c", "#c9720a", "#a259ff", "#d03b3b", "#0b8f8f"];

// Same 4-tier band DashboardActiveProjects uses for raw completion
// percentage — a distinct scale from healthState's, which factors in
// blocked/overdue penalties, not just done/total.
export function progressColor(percent: number): string {
  if (percent >= 90) return "#16a34a";
  if (percent >= 70) return "#e86a33";
  if (percent >= 30) return "#f59e0b";
  return "#dc2626";
}

export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
