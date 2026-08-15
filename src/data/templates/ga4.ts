import type { TemplateDef } from "./types";

export const ga4Template: TemplateDef = {
  key: "ga4",
  name: "GA4",
  technologyKey: "ga4",
  tasks: [
    {
      canonicalKey: "access.ga4",
      stage: "access_credentials",
      title: "Confirm GA4 access",
      priority: "HIGH",
    },
    {
      canonicalKey: "analytics.ga4.property",
      stage: "analytics_tracking",
      title: "Create/select GA4 property & data stream",
      dependsOn: ["access.ga4"],
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
  ],
};
