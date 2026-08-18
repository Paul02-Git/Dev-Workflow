export type ChecklistTask = {
  id: string;
  title: string;
  effectiveStatus: string;
  stageName: string;
};

export function groupChecklistByStage(tasks: ChecklistTask[]): Map<string, ChecklistTask[]> {
  const byStage = new Map<string, ChecklistTask[]>();
  for (const t of tasks) {
    if (!byStage.has(t.stageName)) byStage.set(t.stageName, []);
    byStage.get(t.stageName)!.push(t);
  }
  return byStage;
}

/** Fills stage groups up to `limit` total tasks, stopping mid-stage if needed. */
export function truncateChecklistGroups(
  byStage: Map<string, ChecklistTask[]>,
  limit: number
): { groups: [string, ChecklistTask[]][]; shown: number } {
  const groups: [string, ChecklistTask[]][] = [];
  let shown = 0;
  for (const [stageName, stageTasks] of byStage) {
    if (shown >= limit) break;
    const slice = stageTasks.slice(0, limit - shown);
    groups.push([stageName, slice]);
    shown += slice.length;
  }
  return { groups, shown };
}
