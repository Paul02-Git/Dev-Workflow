import type { StageKey } from "@/data/stages";

/**
 * The internal app tracks up to 18 granular stages (Access & Credentials,
 * Integrations, Ecommerce, Security, Handoff...), which is the right level
 * of detail for Paul but too much for a client glancing at "where are we."
 * The Client Portal groups them into 5 client-facing phases instead —
 * derived from real stage/task data (a phase is only shown if the project
 * actually has a stage in it), never fabricated.
 */
export const CLIENT_PORTAL_PHASES: { name: string; stageKeys: StageKey[] }[] = [
  { name: "Discovery", stageKeys: ["discovery", "access_credentials", "planning"] },
  { name: "Design", stageKeys: ["design"] },
  { name: "Development", stageKeys: ["development", "integrations", "seo", "analytics_tracking", "crm_email", "ecommerce", "advertising"] },
  { name: "QA", stageKeys: ["qa", "performance", "security"] },
  { name: "Launch", stageKeys: ["deployment", "launch", "handoff", "post_launch"] },
];
