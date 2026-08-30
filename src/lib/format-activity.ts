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
    case "project_created_via_intake":
      return { actor, rest: row.detail ? `submitted the intake form — ${row.detail}` : "submitted the intake form" };
    case "handoff_link_generated":
      return { actor, rest: "generated the handoff link" };
    case "handoff_link_revoked":
      return { actor, rest: "revoked the handoff link" };
    case "handoff_viewed":
      return { actor, rest: "viewed the handoff page" };
    case "client_logged_in":
      return { actor, rest: "logged into the portal" };
    case "maintenance_run_generated":
      return { actor, rest: row.detail ? `generated a maintenance checklist — ${row.detail}` : "generated a maintenance checklist" };
    case "client_file_uploaded":
      return { actor, rest: row.detail ? `uploaded a file: ${row.detail}` : "uploaded a file" };
    case "message_posted":
    case "client_message_posted": {
      const body = row.detail ?? "";
      const truncated = body.length > 60 ? `${body.slice(0, 60)}…` : body;
      return { actor, rest: `sent a message: "${truncated}"` };
    }
    default:
      return { actor, rest: row.detail ? `${row.action.replace(/_/g, " ")}: ${row.detail}` : row.action.replace(/_/g, " ") };
  }
}

// Actions genuinely triggered by the client, not the agency — the same
// distinction already established for actorName attribution (see
// PROJECT_STATUS.md's "real 'who did this' tracking" entry): a client
// opening the handoff page, logging into the portal, uploading a file,
// posting a portal message, or submitting the public New Client Intake
// form (which creates both a client and a project — see
// submitIntakeAction/createProjectWithWorkflow's actorName override).
// Everything else (status changes, agency-initiated project creation,
// maintenance runs, Paul's own messages) is agency-side.
const CLIENT_ACTIVITY_ACTIONS = new Set([
  "handoff_viewed",
  "client_logged_in",
  "client_file_uploaded",
  "client_message_posted",
  "project_created_via_intake",
]);

export function isClientActivity(row: { action: string }): boolean {
  return CLIENT_ACTIVITY_ACTIONS.has(row.action);
}

/** Count of activity rows from the last 24h — a real "recent" signal, not a fabricated "unread" count (this app has no per-user read state to track). */
export function countRecentActivity(rows: { createdAt: Date | string }[]): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return rows.filter((row) => now - new Date(row.createdAt).getTime() < dayMs).length;
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
