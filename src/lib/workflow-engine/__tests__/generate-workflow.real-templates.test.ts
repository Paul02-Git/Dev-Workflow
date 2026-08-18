import { describe, expect, it } from "vitest";
import { generateWorkflow } from "../generate-workflow";

describe("generateWorkflow — real seeded templates", () => {
  it("WordPress + Elementor + GA4 + GSC: access.wp_admin appears exactly once", () => {
    const result = generateWorkflow(["wordpress", "elementor", "ga4", "gsc"]);

    const wpAdmin = result.tasks.filter((t) => t.canonicalKey === "access.wp_admin");
    expect(wpAdmin).toHaveLength(1);
    // Contributed only by wordpress here (klaviyo not selected)
    expect(wpAdmin[0].sourceTemplateKeys).toEqual(["wordpress"]);
  });

  it("GA4/GSC/Clarity/GTM: properties are created by the agency, not gated on client-granted access, with ownership handed over at the end", () => {
    const result = generateWorkflow(["ga4", "gsc", "clarity", "gtm"]);
    const keys = new Set(result.tasks.map((t) => t.canonicalKey));

    // property/container creation tasks exist and don't wait on any client access grant
    for (const [creationKey, verificationKey, handoffKey] of [
      ["analytics.ga4.property", "analytics.ga4.verify_conversions", "handoff.ga4_ownership"],
      ["seo.gsc.add_property", "seo.gsc.pages_indexed", "handoff.gsc_ownership"],
      ["tracking.clarity.project", "tracking.clarity.verify_production", "handoff.clarity_ownership"],
      ["tracking.gtm.container_created", "tracking.gtm.production_verification", "handoff.gtm_ownership"],
    ] as const) {
      expect(keys.has(creationKey)).toBe(true);
      expect(keys.has(handoffKey)).toBe(true);
      expect(
        result.dependencies.some((d) => d.taskCanonicalKey === handoffKey && d.dependsOnCanonicalKey === verificationKey)
      ).toBe(true);
    }

    // handoff ownership tasks land in the handoff stage, after the working setup is verified
    const order = new Map(result.tasks.map((t, i) => [t.canonicalKey, i]));
    expect(order.get("analytics.ga4.verify_conversions")!).toBeLessThan(order.get("handoff.ga4_ownership")!);

    for (const dep of result.dependencies) {
      expect(keys.has(dep.taskCanonicalKey)).toBe(true);
      expect(keys.has(dep.dependsOnCanonicalKey)).toBe(true);
    }
  });

  it("GSC ownership verification depends on domain access, since it's a real DNS TXT prerequisite", () => {
    const result = generateWorkflow(["gsc"]);
    expect(
      result.dependencies.some(
        (d) => d.taskCanonicalKey === "seo.gsc.verify_ownership" && d.dependsOnCanonicalKey === "access.domain_registrar"
      )
    ).toBe(true);
  });

  it("WordPress + Elementor: Cloudways setup precedes core install, and forms wait on SMTP", () => {
    const result = generateWorkflow(["wordpress", "elementor"]);
    const keys = new Set(result.tasks.map((t) => t.canonicalKey));

    for (const key of [
      "wp.cloudways_server",
      "wp.cloudways_clone_template",
      "wp.cloudways_access",
      "wp.smtp_configured",
      "wp.password_protect_removed",
      "wp.reading_seo_reenable",
      "elementor.global_colors",
      "elementor.global_fonts",
      "elementor.global_layout",
    ]) {
      expect(keys.has(key)).toBe(true);
    }

    // forms explicitly wait on SMTP being configured, not just built
    expect(
      result.dependencies.some(
        (d) => d.taskCanonicalKey === "elementor.forms" && d.dependsOnCanonicalKey === "wp.smtp_configured"
      )
    ).toBe(true);

    // Cloudways setup happens before WordPress core is "installed"
    const order = new Map(result.tasks.map((t, i) => [t.canonicalKey, i]));
    expect(order.get("wp.cloudways_access")!).toBeLessThan(order.get("wp.install")!);
    // launch-day re-indexing happens after password protection is removed
    expect(order.get("wp.password_protect_removed")!).toBeLessThan(order.get("wp.reading_seo_reenable")!);

    // no dangling edges
    for (const dep of result.dependencies) {
      expect(keys.has(dep.taskCanonicalKey)).toBe(true);
      expect(keys.has(dep.dependsOnCanonicalKey)).toBe(true);
    }
  });

  it("GA4 install is dropped (dangling dependency) when GTM is not selected", () => {
    const result = generateWorkflow(["ga4"]);
    const install = result.tasks.find((t) => t.canonicalKey === "analytics.ga4.install");
    expect(install).toBeDefined();
    // its GTM dependency should simply be absent, not cause an error
    const dep = result.dependencies.find(
      (d) => d.taskCanonicalKey === "analytics.ga4.install" && d.dependsOnCanonicalKey.startsWith("tracking.gtm")
    );
    expect(dep).toBeUndefined();
  });

  it("GA4 install depends on GTM container install when both are selected", () => {
    const result = generateWorkflow(["ga4", "gtm"]);
    const dep = result.dependencies.find(
      (d) =>
        d.taskCanonicalKey === "analytics.ga4.install" &&
        d.dependsOnCanonicalKey === "tracking.gtm.container_installed"
    );
    expect(dep).toBeDefined();
  });

  it("Klaviyo signup form depends on whichever CMS admin access is actually selected", () => {
    const wpResult = generateWorkflow(["wordpress", "klaviyo"]);
    expect(
      wpResult.dependencies.some(
        (d) => d.taskCanonicalKey === "crm.klaviyo.signup_form" && d.dependsOnCanonicalKey === "access.wp_admin"
      )
    ).toBe(true);

    const shopifyResult = generateWorkflow(["shopify", "klaviyo"]);
    expect(
      shopifyResult.dependencies.some(
        (d) => d.taskCanonicalKey === "crm.klaviyo.signup_form" && d.dependsOnCanonicalKey === "access.shopify_admin"
      )
    ).toBe(true);

    // Klaviyo alone doesn't drag in a CMS-specific access task
    const klaviyoOnly = generateWorkflow(["klaviyo"]);
    expect(klaviyoOnly.tasks.some((t) => t.canonicalKey === "access.wp_admin")).toBe(false);
    expect(klaviyoOnly.tasks.some((t) => t.canonicalKey === "access.shopify_admin")).toBe(false);
  });

  it("Elementor + Shopify: qa.visual.mobile dedupes into a single QA task", () => {
    const result = generateWorkflow(["wordpress", "elementor", "shopify"]);
    const mobileQA = result.tasks.filter((t) => t.canonicalKey === "qa.visual.mobile");
    expect(mobileQA).toHaveLength(1);
    expect(mobileQA[0].sourceTemplateKeys.sort()).toEqual(["elementor", "shopify"]);
    expect(mobileQA[0].isCritical).toBe(true);
  });

  it("a Shopify-only project excludes stages irrelevant to it (analytics, CRM/email)", () => {
    const result = generateWorkflow(["shopify"]);
    const stageKeys = result.stages.map((s) => s.stageKey);
    expect(stageKeys).not.toContain("analytics_tracking");
    expect(stageKeys).not.toContain("crm_email");
    expect(stageKeys).toContain("ecommerce");
  });

  it("Meta Ads generates the Advertising stage and a full Setup->Testing->Verification chain", () => {
    const result = generateWorkflow(["meta_ads"]);
    const stageKeys = result.stages.map((s) => s.stageKey);
    expect(stageKeys).toContain("advertising");

    const keys = new Set(result.tasks.map((t) => t.canonicalKey));
    expect(keys.has("ads.meta.pixel_install")).toBe(true);
    expect(keys.has("ads.meta.event_testing")).toBe(true);
    expect(keys.has("ads.meta.production_verification")).toBe(true);
  });

  it("GHL generates a pipeline and end-to-end QA chain", () => {
    const result = generateWorkflow(["ghl"]);
    const keys = new Set(result.tasks.map((t) => t.canonicalKey));
    expect(keys.has("crm.ghl.pipeline")).toBe(true);
    expect(keys.has("crm.ghl.test_lead_submission")).toBe(true);

    const dep = result.dependencies.find(
      (d) => d.taskCanonicalKey === "crm.ghl.test_lead_submission" && d.dependsOnCanonicalKey === "crm.ghl.forms"
    );
    expect(dep).toBeDefined();
  });

  it("always-included templates (discovery, QA, handoff) are present with zero technologies selected", () => {
    const result = generateWorkflow([]);
    expect(result.tasks.some((t) => t.canonicalKey === "discovery.kickoff_call")).toBe(true);
    expect(result.tasks.some((t) => t.canonicalKey === "handoff.final_approval")).toBe(true);
    expect(result.tasks.some((t) => t.canonicalKey === "qa.security.backup_confirmed")).toBe(true);
  });

  it("every dependency target exists in the generated task set (no dangling edges survive)", () => {
    const result = generateWorkflow([
      "wordpress",
      "elementor",
      "shopify",
      "ga4",
      "gtm",
      "gsc",
      "clarity",
      "klaviyo",
      "printify",
      "ghl",
      "meta_ads",
    ]);
    const keys = new Set(result.tasks.map((t) => t.canonicalKey));
    for (const dep of result.dependencies) {
      expect(keys.has(dep.taskCanonicalKey)).toBe(true);
      expect(keys.has(dep.dependsOnCanonicalKey)).toBe(true);
    }
  });

  it("full tech stack generates a plan without throwing and produces a reasonable task count", () => {
    const result = generateWorkflow([
      "wordpress",
      "elementor",
      "shopify",
      "ga4",
      "gtm",
      "gsc",
      "clarity",
      "klaviyo",
      "printify",
      "ghl",
      "meta_ads",
    ]);
    expect(result.tasks.length).toBeGreaterThan(50);
    expect(result.stages.length).toBeGreaterThan(5);
  });
});
