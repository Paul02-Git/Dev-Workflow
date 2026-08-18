export type TaskLookup = {
  status: (canonicalKey: string) => string | undefined;
  daysSince: (canonicalKey: string) => number | null;
};

export type ForgottenTaskIssue = {
  id: string;
  message: string;
  area: string;
};

type Rule = (lookup: TaskLookup) => ForgottenTaskIssue | null;

const DONE_STATES = new Set(["DONE", "SKIPPED"]);
const isDone = (status: string | undefined) => !!status && DONE_STATES.has(status);

/**
 * Hand-written heuristics — this is the non-AI "Check Project" feature.
 * Each rule only fires if the task it references actually exists in the
 * project's generated task set (undefined status = task wasn't generated,
 * i.e. that technology wasn't selected — not an issue to flag).
 * Structured so adding a new rule is just a new function in this array,
 * not a schema change.
 */
const RULES: Rule[] = [
  (lookup) => {
    const install = lookup.status("analytics.ga4.install");
    const verified = lookup.status("analytics.ga4.verify_conversions");
    const days = lookup.daysSince("analytics.ga4.install");
    if (isDone(install) && !isDone(verified) && (days ?? 0) >= 3) {
      return {
        id: "ga4_conversions_unverified",
        area: "Analytics & Tracking",
        message: "GA4 installed but conversion events aren't verified.",
      };
    }
    return null;
  },
  (lookup) => {
    const verified = lookup.status("seo.gsc.verify_ownership");
    const submitted = lookup.status("seo.gsc.sitemap_submitted");
    if (isDone(verified) && !isDone(submitted)) {
      return {
        id: "gsc_sitemap_missing",
        area: "SEO",
        message: "GSC connected but sitemap isn't submitted.",
      };
    }
    return null;
  },
  (lookup) => {
    const backup = lookup.status("qa.security.backup_confirmed");
    const days = lookup.daysSince("qa.security.backup_confirmed");
    if (!isDone(backup) && backup !== undefined && (days ?? 0) >= 5) {
      return {
        id: "backup_not_recorded",
        area: "Security",
        message: "Production backup isn't recorded.",
      };
    }
    return null;
  },
  (lookup) => {
    const install = lookup.status("tracking.clarity.install");
    const verified = lookup.status("tracking.clarity.verify_production");
    if (isDone(install) && !isDone(verified)) {
      return {
        id: "clarity_events_untested",
        area: "Analytics & Tracking",
        message: "Clarity is installed but production data isn't verified.",
      };
    }
    return null;
  },
  (lookup) => {
    const form = lookup.status("crm.klaviyo.signup_form");
    const tested = lookup.status("crm.klaviyo.form_test_submission");
    if (isDone(form) && !isDone(tested)) {
      return {
        id: "klaviyo_form_untested",
        area: "CRM & Email",
        message: "Klaviyo form exists but no test submission is recorded.",
      };
    }
    return null;
  },
  (lookup) => {
    const published = lookup.status("printify.publish_verify");
    const samples = lookup.status("printify.physical_samples");
    if (isDone(published) && !isDone(samples)) {
      return {
        id: "printify_samples_not_ordered",
        area: "Fulfillment",
        message: "Printify products are published but physical samples haven't been ordered/approved.",
      };
    }
    return null;
  },
  (lookup) => {
    const cardOnFile = lookup.status("printify.payment_card");
    const e2eOrder = lookup.status("printify.e2e_test_order");
    const days = lookup.daysSince("printify.payment_card");
    if (isDone(cardOnFile) && !isDone(e2eOrder) && (days ?? 0) >= 3) {
      return {
        id: "printify_e2e_order_untested",
        area: "Fulfillment",
        message: "Printify is connected but no end-to-end test order has been verified.",
      };
    }
    return null;
  },
  (lookup) => {
    const passwordRemoved = lookup.status("wp.password_protect_removed");
    const seoReenabled = lookup.status("wp.reading_seo_reenable");
    if (isDone(passwordRemoved) && !isDone(seoReenabled)) {
      return {
        id: "wp_search_engines_still_discouraged",
        area: "Launch",
        message: "Site is public but still discouraging search engines from indexing it.",
      };
    }
    return null;
  },
  (lookup) => {
    const formsBuilt = lookup.status("elementor.forms");
    const smtpConfigured = lookup.status("wp.smtp_configured");
    if (isDone(formsBuilt) && !isDone(smtpConfigured)) {
      return {
        id: "wp_forms_smtp_unconfigured",
        area: "Development",
        message: "Forms are built but SMTP isn't configured — submissions may not be delivering.",
      };
    }
    return null;
  },
];

export function checkProject(lookup: TaskLookup): ForgottenTaskIssue[] {
  return RULES.map((rule) => rule(lookup)).filter((x): x is ForgottenTaskIssue => x !== null);
}
