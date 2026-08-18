import type { TemplateDef } from "./types";

export const clarityTemplate: TemplateDef = {
  key: "clarity",
  name: "Microsoft Clarity",
  technologyKey: "clarity",
  tasks: [
    {
      canonicalKey: "tracking.clarity.project",
      stage: "analytics_tracking",
      title: "Create Clarity project",
      description: "Created under the agency Microsoft account during the build.",
      dependsOn: ["discovery.scope_confirmed"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "tracking.clarity.install",
      stage: "analytics_tracking",
      title: "Install Clarity tracking via GTM",
      dependsOn: ["tracking.clarity.project", "tracking.gtm.container_installed"],
      priority: "HIGH",
    },
    {
      canonicalKey: "tracking.clarity.verify_recordings",
      stage: "analytics_tracking",
      title: "Verify recordings & sessions are captured",
      dependsOn: ["tracking.clarity.install"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "tracking.clarity.verify_heatmaps",
      stage: "analytics_tracking",
      title: "Verify heatmaps, dead clicks & rage clicks",
      dependsOn: ["tracking.clarity.verify_recordings"],
      priority: "LOW",
    },
    {
      canonicalKey: "tracking.clarity.verify_production",
      stage: "analytics_tracking",
      title: "Verify production data is flowing",
      dependsOn: ["tracking.clarity.verify_recordings", "tracking.gtm.published"],
      priority: "HIGH",
      isCritical: true,
    },
    {
      canonicalKey: "handoff.clarity_ownership",
      stage: "handoff",
      title: "Add client as Clarity project owner",
      description: "Grant the client's Microsoft account owner access to the project built under the agency account.",
      dependsOn: ["tracking.clarity.verify_production"],
      priority: "LOW",
    },
  ],
};
