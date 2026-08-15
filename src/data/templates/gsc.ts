import type { TemplateDef } from "./types";

export const gscTemplate: TemplateDef = {
  key: "gsc",
  name: "Google Search Console",
  technologyKey: "gsc",
  tasks: [
    {
      canonicalKey: "access.gsc",
      stage: "access_credentials",
      title: "Confirm Google Search Console access",
      priority: "HIGH",
    },
    {
      canonicalKey: "seo.gsc.add_property",
      stage: "seo",
      title: "Add property in GSC",
      dependsOn: ["access.gsc"],
      priority: "HIGH",
    },
    {
      canonicalKey: "seo.gsc.verify_ownership",
      stage: "seo",
      title: "Verify site ownership",
      dependsOn: ["seo.gsc.add_property"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "seo.gsc.verify_correct_property",
      stage: "seo",
      title: "Verify correct property (domain vs. URL-prefix)",
      dependsOn: ["seo.gsc.verify_ownership"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "seo.gsc.sitemap_submitted",
      stage: "seo",
      title: "Submit XML sitemap",
      dependsOn: ["seo.gsc.verify_correct_property"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "seo.gsc.check_indexing",
      stage: "seo",
      title: "Check indexing status & review errors",
      dependsOn: ["seo.gsc.sitemap_submitted"],
      priority: "HIGH",
    },
    {
      canonicalKey: "seo.gsc.core_web_vitals",
      stage: "performance",
      title: "Review Core Web Vitals report",
      dependsOn: ["seo.gsc.check_indexing"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "seo.gsc.https_review",
      stage: "seo",
      title: "Review HTTPS report",
      dependsOn: ["seo.gsc.verify_ownership"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "seo.gsc.pages_indexed",
      stage: "seo",
      title: "Verify important pages are indexed",
      dependsOn: ["seo.gsc.check_indexing"],
      priority: "HIGH",
      isCritical: true,
    },
  ],
};
