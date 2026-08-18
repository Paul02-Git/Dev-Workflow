import type { TemplateDef } from "./types";

export const ga4Template: TemplateDef = {
  key: "ga4",
  name: "GA4",
  technologyKey: "ga4",
  tasks: [
    {
      canonicalKey: "analytics.ga4.property",
      stage: "analytics_tracking",
      title: "Create GA4 property & data stream",
      description: "Created and owned under the agency Google account during the build.",
      dependsOn: ["discovery.scope_confirmed"],
      priority: "HIGH",
    },
    {
      canonicalKey: "analytics.ga4.install",
      stage: "analytics_tracking",
      title: "Install GA4 tracking via GTM",
      dependsOn: ["analytics.ga4.property", "tracking.gtm.container_installed"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "analytics.ga4.verify_pageviews",
      stage: "analytics_tracking",
      title: "Verify page views in Realtime/DebugView",
      dependsOn: ["analytics.ga4.install"],
      priority: "HIGH",
    },
    {
      canonicalKey: "analytics.ga4.configure_events",
      stage: "analytics_tracking",
      title: "Configure events",
      dependsOn: ["analytics.ga4.verify_pageviews"],
      priority: "MEDIUM",
    },
    {
      canonicalKey: "analytics.ga4.configure_conversions",
      stage: "analytics_tracking",
      title: "Configure conversions",
      dependsOn: ["analytics.ga4.configure_events"],
      priority: "HIGH",
    },
    {
      canonicalKey: "analytics.ga4.configure_audiences",
      stage: "analytics_tracking",
      title: "Configure audiences",
      dependsOn: ["analytics.ga4.configure_conversions"],
      priority: "LOW",
    },
    {
      canonicalKey: "analytics.ga4.verify_conversions",
      stage: "analytics_tracking",
      title: "Verify GA4 conversion events in production",
      dependsOn: ["analytics.ga4.configure_conversions", "tracking.gtm.published"],
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "handoff.ga4_ownership",
      stage: "handoff",
      title: "Add client as GA4 account owner",
      description: "Grant the client's Google account Owner/Admin access to the property built under the agency account.",
      dependsOn: ["analytics.ga4.verify_conversions"],
      priority: "MEDIUM",
    },
  ],
};
