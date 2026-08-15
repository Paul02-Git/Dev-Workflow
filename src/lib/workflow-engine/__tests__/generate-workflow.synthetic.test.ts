import { describe, expect, it } from "vitest";
import { generateWorkflow, WorkflowEngineError } from "../generate-workflow";
import type { TemplateDef } from "@/data/templates/types";

const STAGES = [
  { key: "access", name: "Access" },
  { key: "build", name: "Build" },
  { key: "qa", name: "QA" },
  { key: "unused", name: "Unused" },
];

describe("generateWorkflow — synthetic templates", () => {
  it("includes only tasks from selected technologies", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [{ canonicalKey: "a.task1", stage: "build", title: "A task" }],
      },
      {
        key: "b",
        name: "b",
        technologyKey: "techB",
        tasks: [{ canonicalKey: "b.task1", stage: "build", title: "B task" }],
      },
    ];

    const result = generateWorkflow(["techA"], { templates, stages: STAGES });

    expect(result.tasks.map((t) => t.canonicalKey)).toEqual(["a.task1"]);
  });

  it("always includes alwaysInclude templates regardless of tech selection", () => {
    const templates: TemplateDef[] = [
      {
        key: "cross",
        name: "cross",
        alwaysInclude: true,
        tasks: [{ canonicalKey: "cross.task1", stage: "access", title: "Cross task" }],
      },
    ];

    const result = generateWorkflow([], { templates, stages: STAGES });

    expect(result.tasks.map((t) => t.canonicalKey)).toEqual(["cross.task1"]);
  });

  it("dedupes a task emitted by two different templates into exactly one task", () => {
    const templates: TemplateDef[] = [
      {
        key: "wordpress",
        name: "wordpress",
        technologyKey: "wordpress",
        tasks: [
          { canonicalKey: "access.wp_admin", stage: "access", title: "Receive WP admin access" },
        ],
      },
      {
        key: "klaviyo",
        name: "klaviyo",
        technologyKey: "klaviyo",
        tasks: [
          { canonicalKey: "access.wp_admin", stage: "access", title: "Receive WP admin access" },
          { canonicalKey: "klaviyo.form", stage: "build", title: "Build signup form", dependsOn: ["access.wp_admin"] },
        ],
      },
    ];

    const result = generateWorkflow(["wordpress", "klaviyo"], { templates, stages: STAGES });

    const wpAdminTasks = result.tasks.filter((t) => t.canonicalKey === "access.wp_admin");
    expect(wpAdminTasks).toHaveLength(1);
    expect(wpAdminTasks[0].sourceTemplateKeys.sort()).toEqual(["klaviyo", "wordpress"]);
  });

  it("merges isCritical with OR across contributing templates", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [{ canonicalKey: "shared.task", stage: "build", title: "Shared", isCritical: false }],
      },
      {
        key: "b",
        name: "b",
        technologyKey: "techB",
        tasks: [{ canonicalKey: "shared.task", stage: "build", title: "Shared", isCritical: true }],
      },
    ];

    const result = generateWorkflow(["techA", "techB"], { templates, stages: STAGES });
    expect(result.tasks.find((t) => t.canonicalKey === "shared.task")?.isCritical).toBe(true);
  });

  it("unions subtasks contributed by multiple templates", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [{ canonicalKey: "shared.task", stage: "build", title: "Shared", subtasks: ["x", "y"] }],
      },
      {
        key: "b",
        name: "b",
        technologyKey: "techB",
        tasks: [{ canonicalKey: "shared.task", stage: "build", title: "Shared", subtasks: ["y", "z"] }],
      },
    ];

    const result = generateWorkflow(["techA", "techB"], { templates, stages: STAGES });
    expect(result.tasks.find((t) => t.canonicalKey === "shared.task")?.subtasks.sort()).toEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("resolves a dependency edge onto a task that was only materialized once due to dedup", () => {
    const templates: TemplateDef[] = [
      {
        key: "wordpress",
        name: "wordpress",
        technologyKey: "wordpress",
        tasks: [{ canonicalKey: "access.wp_admin", stage: "access", title: "WP admin" }],
      },
      {
        key: "elementor",
        name: "elementor",
        technologyKey: "elementor",
        tasks: [
          { canonicalKey: "access.wp_admin", stage: "access", title: "WP admin" },
          { canonicalKey: "elementor.header", stage: "build", title: "Build header", dependsOn: ["access.wp_admin"] },
        ],
      },
      {
        key: "qa",
        name: "QA",
        alwaysInclude: true,
        tasks: [
          { canonicalKey: "qa.check", stage: "qa", title: "QA check", dependsOn: ["access.wp_admin"] },
        ],
      },
    ];

    const result = generateWorkflow(["wordpress", "elementor"], { templates, stages: STAGES });

    expect(result.tasks.filter((t) => t.canonicalKey === "access.wp_admin")).toHaveLength(1);
    const depEdges = result.dependencies.filter((d) => d.dependsOnCanonicalKey === "access.wp_admin");
    expect(depEdges.map((d) => d.taskCanonicalKey).sort()).toEqual(["elementor.header", "qa.check"]);
  });

  it("drops dangling dependencies whose prerequisite technology was not selected", () => {
    const templates: TemplateDef[] = [
      {
        key: "ga4",
        name: "ga4",
        technologyKey: "ga4",
        tasks: [
          {
            canonicalKey: "ga4.install",
            stage: "build",
            title: "Install GA4",
            dependsOn: ["gtm.container_installed"], // GTM not selected in this test
          },
        ],
      },
    ];

    const result = generateWorkflow(["ga4"], { templates, stages: STAGES });

    expect(result.tasks.map((t) => t.canonicalKey)).toEqual(["ga4.install"]);
    expect(result.dependencies).toHaveLength(0);
  });

  it("excludes stages that end up with zero generated tasks", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [{ canonicalKey: "a.task1", stage: "build", title: "A task" }],
      },
    ];

    const result = generateWorkflow(["techA"], { templates, stages: STAGES });

    expect(result.stages.map((s) => s.stageKey)).toEqual(["build"]);
  });

  it("orders stages by the master stage list order, not selection order", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [
          { canonicalKey: "qa.task", stage: "qa", title: "QA task" },
          { canonicalKey: "access.task", stage: "access", title: "Access task" },
        ],
      },
    ];

    const result = generateWorkflow(["techA"], { templates, stages: STAGES });
    expect(result.stages.map((s) => s.stageKey)).toEqual(["access", "qa"]);
  });

  it("topologically orders tasks so dependencies come before dependents", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [
          { canonicalKey: "step3", stage: "build", title: "Step 3", dependsOn: ["step2"] },
          { canonicalKey: "step1", stage: "build", title: "Step 1" },
          { canonicalKey: "step2", stage: "build", title: "Step 2", dependsOn: ["step1"] },
        ],
      },
    ];

    const result = generateWorkflow(["techA"], { templates, stages: STAGES });
    const positions = Object.fromEntries(result.tasks.map((t) => [t.canonicalKey, t.sortOrder]));
    expect(positions.step1).toBeLessThan(positions.step2);
    expect(positions.step2).toBeLessThan(positions.step3);
  });

  it("throws a WorkflowEngineError on a dependency cycle", () => {
    const templates: TemplateDef[] = [
      {
        key: "a",
        name: "a",
        technologyKey: "techA",
        tasks: [
          { canonicalKey: "x", stage: "build", title: "X", dependsOn: ["y"] },
          { canonicalKey: "y", stage: "build", title: "Y", dependsOn: ["x"] },
        ],
      },
    ];

    expect(() => generateWorkflow(["techA"], { templates, stages: STAGES })).toThrow(
      WorkflowEngineError
    );
  });
});
