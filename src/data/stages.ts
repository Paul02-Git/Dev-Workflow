// The fixed master stage list — all 18 from the spec.
export const STAGES = [
  { key: "discovery", name: "Discovery" },
  { key: "access_credentials", name: "Access & Credentials" },
  { key: "planning", name: "Planning" },
  { key: "design", name: "Design" },
  { key: "development", name: "Development" },
  { key: "integrations", name: "Integrations" },
  { key: "seo", name: "SEO" },
  { key: "analytics_tracking", name: "Analytics & Tracking" },
  { key: "crm_email", name: "CRM & Email" },
  { key: "ecommerce", name: "Ecommerce" },
  { key: "advertising", name: "Advertising" },
  { key: "qa", name: "QA" },
  { key: "performance", name: "Performance" },
  { key: "security", name: "Security" },
  { key: "deployment", name: "Deployment" },
  { key: "launch", name: "Launch" },
  { key: "handoff", name: "Handoff" },
  { key: "post_launch", name: "Post-Launch" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
