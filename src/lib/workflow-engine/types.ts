export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type GeneratedTask = {
  canonicalKey: string;
  stageKey: string;
  title: string;
  description?: string;
  priority: Priority;
  isCritical: boolean;
  subtasks: string[];
  /** Which template(s) contributed this task — for traceability/debugging. */
  sourceTemplateKeys: string[];
  sortOrder: number;
};

export type GeneratedStage = {
  stageKey: string;
  sortOrder: number;
};

export type GeneratedDependency = {
  taskCanonicalKey: string;
  dependsOnCanonicalKey: string;
};

export type GeneratedWorkflow = {
  stages: GeneratedStage[];
  tasks: GeneratedTask[];
  dependencies: GeneratedDependency[];
};
