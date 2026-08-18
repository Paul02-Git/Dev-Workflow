export type ActivityRow = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date | string;
  actorName: string;
  taskTitle: string | null;
};

const STATUS_READABLE: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  DONE: "Done",
  SKIPPED: "Skipped",
};

/**
 * Split into {actor, rest} rather than one string so the actor's name can
 * be rendered bold and the rest as plain text, matching the "Sarah
 * connected Google Analytics" style — the actor is always the sentence's
 * subject, never re-stated inside `rest`.
 */
export function formatActivitySentence(row: ActivityRow): { actor: string; rest: string } {
  const actor = row.actorName;
  switch (row.action) {
    case "task_status_changed":
      return { actor, rest: `marked ${row.taskTitle ?? "a task"} ${STATUS_READABLE[row.detail ?? ""] ?? row.detail}` };
    case "project_status_changed":
      return { actor, rest: `changed project status to ${row.detail}` };
    case "task_added_manually":
      return { actor, rest: `added task: ${row.detail}` };
    case "project_created":
      return { actor, rest: row.detail ? `created this project — ${row.detail}` : "created this project" };
    case "handoff_link_generated":
      return { actor, rest: "generated the handoff link" };
    case "handoff_link_revoked":
      return { actor, rest: "revoked the handoff link" };
    case "handoff_viewed":
      return { actor, rest: "viewed the handoff page" };
    case "maintenance_run_generated":
      return { actor, rest: row.detail ? `generated a maintenance checklist — ${row.detail}` : "generated a maintenance checklist" };
    default:
      return { actor, rest: row.detail ? `${row.action.replace(/_/g, " ")}: ${row.detail}` : row.action.replace(/_/g, " ") };
  }
}

export function relativeTime(date: Date | string): string {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

/** Bucket label for grouping a full activity history — "Today" / "Yesterday" / "This week" / "Earlier". */
export function activityDateBucket(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}
