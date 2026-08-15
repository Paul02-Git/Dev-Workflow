import type { TemplateDef } from "./types";

export const gtmTemplate: TemplateDef = {
  key: "gtm",
  name: "Google Tag Manager",
  technologyKey: "gtm",
  tasks: [
    {
      canonicalKey: "access.gtm",
      stage: "access_credentials",
      title: "Confirm Google Tag Manager access",
      priority: "HIGH",
    },
    {
      canonicalKey: "tracking.gtm.container_created",
      stage: "integrations",
      title: "Create/select GTM container",
      dependsOn: ["access.gtm"],
      priority: "HIGH",
    },
    {
      canonicalKey: "tracking.gtm.container_installed",
      stage: "integrations",
      title: "Install GTM container on the site",
      dependsOn: ["tracking.gtm.container_created"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "tracking.gtm.tags_triggers_variables",
      stage: "integrations",
      title: "Configure tags, triggers, and variables",
      dependsOn: ["tracking.gtm.container_installed"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "tracking.gtm.preview_testing",
      stage: "integrations",
      title: "Preview & test tags before publishing",
      dependsOn: ["tracking.gtm.tags_triggers_variables"],
      priority: "HIGH",
    },
    {
      canonicalKey: "tracking.gtm.published",
      stage: "integrations",
      title: "Publish GTM container",
      dependsOn: ["tracking.gtm.preview_testing"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "tracking.gtm.production_verification",
      stage: "analytics_tracking",
      title: "Verify GTM firing correctly in production",
      dependsOn: ["tracking.gtm.published"],
      priority: "HIGH",
    },
  ],
};
