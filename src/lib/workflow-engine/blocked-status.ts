type TaskLike = { id: string; status: string };
type DependencyLike = { taskId: string; dependsOnTaskId: string };

const TERMINAL: ReadonlySet<string> = new Set(["DONE", "SKIPPED"]);

/**
 * Computes the *effective* status shown in the UI for each task: if a task's
 * stored status isn't already terminal (Done/Skipped) but one of its
 * dependencies isn't terminal either, it displays as Blocked — without
 * mutating the stored status, so a manual override (e.g. marking something
 * Skipped) survives even if its "dependency" is still open.
 */
export function computeEffectiveStatuses(
  tasks: TaskLike[],
  dependencies: DependencyLike[]
): Map<string, string> {
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));
  const depsByTask = new Map<string, string[]>();
  for (const t of tasks) depsByTask.set(t.id, []);
  for (const dep of dependencies) {
    depsByTask.get(dep.taskId)?.push(dep.dependsOnTaskId);
  }

  const effective = new Map<string, string>();
  for (const task of tasks) {
    if (TERMINAL.has(task.status)) {
      effective.set(task.id, task.status);
      continue;
    }
    const deps = depsByTask.get(task.id) ?? [];
    const blocked = deps.some((depId) => !TERMINAL.has(statusById.get(depId) ?? "TODO"));
    effective.set(task.id, blocked ? "BLOCKED" : task.status);
  }
  return effective;
}
