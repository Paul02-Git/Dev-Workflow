import type { TemplateDef } from "./types";

// Always-included templates: discovery/access basics, general QA & security,
// and handoff. These are the "glue" every project gets regardless of which
// technologies are selected.

export const discoveryTemplate: TemplateDef = {
  key: "discovery",
  name: "Discovery & Planning",
  alwaysInclude: true,
  tasks: [
    {
      canonicalKey: "discovery.kickoff_call",
      stage: "discovery",
      title: "Hold project kickoff call",
      priority: "HIGH",
    },
    {
      canonicalKey: "discovery.scope_confirmed",
      stage: "discovery",
      title: "Confirm scope, timeline, and budget in writing",
      dependsOn: ["discovery.kickoff_call"],
      priority: "HIGH",
    },
    {
      canonicalKey: "access.point_of_contact",
      stage: "access_credentials",
      title: "Confirm primary client point of contact",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "access.hosting",
      stage: "access_credentials",
      title: "Receive hosting account access",
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "access.domain_registrar",
      stage: "access_credentials",
      title: "Receive domain registrar access",
      priority: "HIGH",
    },
    {
      canonicalKey: "planning.sitemap",
      stage: "planning",
      title: "Draft sitemap / project plan",
      dependsOn: ["discovery.scope_confirmed"],
      priority: "MEDIUM",
    },
  ],
};

export const qaTemplate: TemplateDef = {
  key: "qa_security",
  name: "General QA & Security",
  alwaysInclude: true,
  tasks: [
    {
      canonicalKey: "qa.browser.chrome",
      stage: "qa",
      title: "Browser QA — Chrome",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "qa.browser.safari",
      stage: "qa",
      title: "Browser QA — Safari",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "qa.browser.firefox",
      stage: "qa",
      title: "Browser QA — Firefox",
      priority: "LOW",
    },
    {
      canonicalKey: "qa.browser.edge",
      stage: "qa",
      title: "Browser QA — Edge",
      priority: "LOW",
    },
    {
      canonicalKey: "qa.functional.forms",
      stage: "qa",
      title: "Verify all forms submit and confirm correctly",
      priority: "HIGH",
      isCritical: true,
    },
    {
      canonicalKey: "qa.functional.links",
      stage: "qa",
      title: "Check internal and external links",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "qa.security.ssl",
      stage: "security",
      title: "Verify SSL is active and forced site-wide",
      priority: "CRITICAL",
      isCritical: true,
    },
    {
      canonicalKey: "qa.security.admin_accounts",
      stage: "security",
      title: "Audit admin accounts and user permissions",
      priority: "HIGH",
    },
    {
      canonicalKey: "qa.security.spam_protection",
      stage: "security",
      title: "Confirm spam/form protection is active",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "qa.security.backup_confirmed",
      stage: "security",
      title: "Confirm and record a production backup",
      priority: "CRITICAL",
      isCritical: true,
    },
  ],
};

export const handoffTemplate: TemplateDef = {
  key: "handoff",
  name: "Client Handoff",
  alwaysInclude: true,
  tasks: [
    {
      canonicalKey: "handoff.client_approval",
      stage: "handoff",
      title: "Get final client approval",
      priority: "CRITICAL",
      isCritical: true,
      dependsOn: ["qa.functional.forms", "qa.security.ssl"],
    },
    {
      canonicalKey: "handoff.docs_admin_access",
      stage: "handoff",
      title: "Document admin access for the client",
      priority: "HIGH",
      dependsOn: ["access.hosting"],
    },
    {
      canonicalKey: "handoff.docs_hosting",
      stage: "handoff",
      title: "Document hosting details",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "handoff.docs_domain",
      stage: "handoff",
      title: "Document domain/DNS details",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "handoff.backup_confirmation",
      stage: "handoff",
      title: "Confirm backups are handed off / documented",
      dependsOn: ["qa.security.backup_confirmed"],
      priority: "HIGH",
    },
    {
      canonicalKey: "handoff.training",
      stage: "handoff",
      title: "Deliver client training session",
      priority: "MEDIUM",
    },
    {
      canonicalKey: "handoff.maintenance_explainer",
      stage: "handoff",
      title: "Explain ongoing maintenance plan",
      priority: "LOW",
    },
    {
      canonicalKey: "handoff.final_approval",
      stage: "handoff",
      title: "Record final sign-off",
      priority: "CRITICAL",
      isCritical: true,
      dependsOn: ["handoff.client_approval"],
    },
  ],
};
