import { STAGES } from "@/data/stages";
import { ALL_TEMPLATES } from "@/data/templates";
import type { TemplateDef, TemplateTaskDef } from "@/data/templates/types";
import type { GeneratedDependency, GeneratedStage, GeneratedTask, GeneratedWorkflow } from "./types";

export class WorkflowEngineError extends Error {}

type Options = {
  templates?: TemplateDef[];
  stages?: readonly { key: string; name: string }[];
};

/**
 * Turns a set of selected technology keys into a deduplicated, dependency-
 * resolved, stage-ordered workflow. Pure function — no DB, no I/O — so it's
 * directly unit-testable and reusable from the project-creation API route.
 *
 * Dedup rule: if more than one matched template emits a task with the same
 * canonicalKey, exactly one task is produced. isCritical is OR'd across all
 * contributing occurrences (any template flagging it critical wins),
 * subtasks are unioned, and title/description/priority come from whichever
 * matched template was first in `templates` order (stable, deterministic).
 */
export function generateWorkflow(
  technologyKeys: string[],
  options: Options = {}
): GeneratedWorkflow {
  const templates = options.templates ?? ALL_TEMPLATES;
  const stageList = options.stages ?? STAGES;
  const stageOrder = new Map(stageList.map((s, i) => [s.key, i]));

  const selectedKeys = new Set(technologyKeys);
  const matchedTemplates = templates.filter(
    (t) => t.alwaysInclude || (t.technologyKey && selectedKeys.has(t.technologyKey))
  );

  // --- 1. Collect every template task occurrence, in template order -------
  type Occurrence = { def: TemplateTaskDef; templateKey: string };
  const occurrences: Occurrence[] = [];
  for (const template of matchedTemplates) {
    for (const taskDef of template.tasks) {
      occurrences.push({ def: taskDef, templateKey: template.key });
    }
  }

  // --- 2. Dedup by canonicalKey, preserving first-seen order --------------
  const order: string[] = [];
  const groups = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = occ.def.canonicalKey;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(occ);
  }

  const tasksByKey = new Map<string, GeneratedTask>();
  for (const key of order) {
    const group = groups.get(key)!;
    const first = group[0].def;

    if (!stageOrder.has(first.stage)) {
      throw new WorkflowEngineError(
        `Template task "${key}" references unknown stage "${first.stage}"`
      );
    }

    const subtasks = Array.from(
      new Set(group.flatMap((occ) => occ.def.subtasks ?? []))
    );
    const isCritical = group.some((occ) => occ.def.isCritical);

    tasksByKey.set(key, {
      canonicalKey: key,
      stageKey: first.stage,
      title: first.title,
      description: first.description,
      priority: first.priority ?? "MEDIUM",
      isCritical,
      subtasks,
      sourceTemplateKeys: Array.from(new Set(group.map((o) => o.templateKey))),
      sortOrder: 0, // assigned after topological sort below
    });
  }

  // --- 3. Resolve dependencies by canonical key, dropping dangling edges --
  // (a dependency target that wasn't generated means its prerequisite
  // technology wasn't selected — the edge is simply omitted rather than
  // treated as an error, since the workflow may be intentionally partial)
  const dependencySet = new Set<string>();
  const dependencies: GeneratedDependency[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    for (const occ of group) {
      for (const dep of occ.def.dependsOn ?? []) {
        if (dep === key) continue; // no self-dependencies
        if (!tasksByKey.has(dep)) continue; // dangling: prerequisite tech not selected
        const edgeId = `${key}->${dep}`;
        if (dependencySet.has(edgeId)) continue;
        dependencySet.add(edgeId);
        dependencies.push({ taskCanonicalKey: key, dependsOnCanonicalKey: dep });
      }
    }
  }

  // --- 4. Topological sort for a sensible overall task order --------------
  // Stable: ties broken by original first-seen order.
  const sortedKeys = topologicalSort(order, dependencies);

  sortedKeys.forEach((key, i) => {
    tasksByKey.get(key)!.sortOrder = i;
  });

  // --- 5. Stages actually used, in master stage order ----------------------
  const usedStageKeys = new Set(Array.from(tasksByKey.values()).map((t) => t.stageKey));
  const stages: GeneratedStage[] = stageList
    .filter((s) => usedStageKeys.has(s.key))
    .map((s, i) => ({ stageKey: s.key, sortOrder: i }));

  const tasks = sortedKeys.map((key) => tasksByKey.get(key)!);

  return { stages, tasks, dependencies };
}

/**
 * Kahn's algorithm. Ties broken by `order` (first-seen order) so the result
 * is deterministic. Throws WorkflowEngineError on a dependency cycle — that
 * indicates a bug in template authoring, not a runtime condition to recover
 * from silently.
 */
function topologicalSort(order: string[], dependencies: GeneratedDependency[]): string[] {
  const indexOf = new Map(order.map((k, i) => [k, i]));
  // dependsOn: task -> [prerequisites]. An edge must be scheduled before the task.
  const prerequisitesOf = new Map<string, Set<string>>();
  const dependentsOf = new Map<string, Set<string>>();
  for (const key of order) {
    prerequisitesOf.set(key, new Set());
    dependentsOf.set(key, new Set());
  }
  for (const dep of dependencies) {
    prerequisitesOf.get(dep.taskCanonicalKey)!.add(dep.dependsOnCanonicalKey);
    dependentsOf.get(dep.dependsOnCanonicalKey)!.add(dep.taskCanonicalKey);
  }

  const ready = order
    .filter((k) => prerequisitesOf.get(k)!.size === 0)
    .sort((a, b) => indexOf.get(a)! - indexOf.get(b)!);

  const remaining = new Map(order.map((k) => [k, prerequisitesOf.get(k)!.size]));
  const result: string[] = [];

  // Simple priority-queue-by-original-order via repeated sort (fine at MVP scale).
  const queue = [...ready];
  while (queue.length > 0) {
    queue.sort((a, b) => indexOf.get(a)! - indexOf.get(b)!);
    const next = queue.shift()!;
    result.push(next);
    for (const dependent of dependentsOf.get(next)!) {
      const remainingCount = remaining.get(dependent)! - 1;
      remaining.set(dependent, remainingCount);
      if (remainingCount === 0) queue.push(dependent);
    }
  }

  if (result.length !== order.length) {
    const stuck = order.filter((k) => !result.includes(k));
    throw new WorkflowEngineError(
      `Dependency cycle detected among template tasks: ${stuck.join(", ")}`
    );
  }

  return result;
}
