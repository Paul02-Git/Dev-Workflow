export type TemplateTaskDef = {
  canonicalKey: string;
  // Stage key. Typed as `string` (not the strict StageKey union) so the
  // workflow engine and its tests can be exercised against synthetic stage
  // lists; real template files should only ever use keys from
  // `src/data/stages.ts` — generateWorkflow() throws at runtime if a task
  // references a stage that isn't in the active stage list.
  stage: string;
  title: string;
  description?: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  isCritical?: boolean;
  /** Canonical keys of tasks this task depends on (may belong to other templates). */
  dependsOn?: string[];
  subtasks?: string[];
};

export type TemplateDef = {
  key: string;
  name: string;
  /** Technology key this template maps to, or undefined for cross-cutting templates. */
  technologyKey?: string;
  /** Always included in generation regardless of selected technologies. */
  alwaysInclude?: boolean;
  tasks: TemplateTaskDef[];
};
