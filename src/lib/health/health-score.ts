export type HealthTaskInput = {
  status: string;
  isCritical: boolean;
  dueDate: Date | null;
};

/**
 * Health % = 60% critical-task completion + 40% overall completion,
 * minus proportional penalties for blocked and overdue tasks. Clamped
 * 0-100.
 *
 * Penalties are *ratio-based* (blocked-tasks / total-tasks), not a flat
 * per-task deduction — a freshly generated project with 80+ tasks
 * naturally has most of them sitting Blocked on a dependency chain that
 * hasn't started yet, which is healthy, not a problem. A flat per-task
 * penalty would zero out the score on day one of every project; the ratio
 * keeps the signal proportional to how *stuck* the project actually is.
 *
 * `effectiveStatuses[i]` must correspond to `tasks[i]` (the Blocked-aware
 * status from computeEffectiveStatuses, not raw stored status).
 */
export function computeHealthScore(
  tasks: HealthTaskInput[],
  effectiveStatuses: string[]
): number {
  if (tasks.length === 0) return 100;

  const isDone = (s: string) => s === "DONE" || s === "SKIPPED";
  const pairs = tasks.map((t, i) => ({ task: t, effectiveStatus: effectiveStatuses[i] ?? "TODO" }));

  const criticalPairs = pairs.filter((p) => p.task.isCritical);
  const criticalCompletion =
    criticalPairs.length === 0
      ? 1
      : criticalPairs.filter((p) => isDone(p.effectiveStatus)).length / criticalPairs.length;

  const doneCount = pairs.filter((p) => isDone(p.effectiveStatus)).length;
  const overallCompletion = doneCount / tasks.length;

  const blockedRatio = pairs.filter((p) => p.effectiveStatus === "BLOCKED").length / tasks.length;
  const now = new Date();
  const overdueRatio =
    pairs.filter((p) => p.task.dueDate && p.task.dueDate < now && !isDone(p.effectiveStatus)).length /
    tasks.length;

  const base = 60 * criticalCompletion + 40 * overallCompletion;
  const penalty = blockedRatio * 15 + overdueRatio * 15;

  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}
