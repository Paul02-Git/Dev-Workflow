// Manual smoke test per the plan's verification section: create real
// projects through the actual query layer (not just the pure engine),
// mark tasks done in dependency order, confirm Blocked status clears,
// confirm health % moves, and confirm Check Project fires the documented
// example scenarios.
import { createClient } from "@/lib/queries/clients";
import { createProjectWithWorkflow, getProjectDetail, updateTaskStatus, getProjectIssues } from "@/lib/queries/projects";

async function main() {
  console.log("--- Creating client ---");
  const client = await createClient({ name: "Smoke Test Co" });
  console.log("client:", client.id);

  console.log("\n--- Creating WordPress + Elementor + GA4 + GSC + Clarity project ---");
  const project = await createProjectWithWorkflow({
    clientId: client.id,
    name: "Smoke Test — WP Site",
    projectType: "WordPress Website",
    technologyKeys: ["wordpress", "elementor", "ga4", "gtm", "gsc", "clarity"],
  });
  console.log("project:", project.id);

  let detail = await getProjectDetail(project.id);
  if (!detail) throw new Error("project detail missing");
  console.log(`stages: ${detail.stages.length}, tasks: ${detail.tasks.length}`);
  console.log("initial health:", detail.healthScore);

  const wpAdmin = detail.tasks.filter((t) => t.canonicalKey === "access.wp_admin");
  console.log(`access.wp_admin count (should be 1): ${wpAdmin.length}`);

  const install = detail.tasks.find((t) => t.canonicalKey === "wp.install")!;
  console.log(`wp.install effective status before deps done (should be BLOCKED): ${install.effectiveStatus}`);

  // Complete the dependency chain: access.hosting -> access.wp_admin -> wp.install
  const hosting = detail.tasks.find((t) => t.canonicalKey === "access.hosting")!;
  await updateTaskStatus(hosting.id, "DONE");
  await updateTaskStatus(wpAdmin[0].id, "DONE");

  detail = await getProjectDetail(project.id);
  const installAfter = detail!.tasks.find((t) => t.canonicalKey === "wp.install")!;
  console.log(`wp.install effective status after deps done (should be TODO): ${installAfter.effectiveStatus}`);

  await updateTaskStatus(installAfter.id, "DONE");

  console.log("\n--- Check Project (before verifying GA4 conversions) ---");
  const ga4Install = detail!.tasks.find((t) => t.canonicalKey === "analytics.ga4.install")!;
  const gtmContainer = detail!.tasks.find((t) => t.canonicalKey === "tracking.gtm.container_installed")!;
  await updateTaskStatus(gtmContainer.id, "DONE");
  await updateTaskStatus(ga4Install.id, "DONE");

  const issuesBefore = await getProjectIssues(project.id);
  console.log(`issues found: ${issuesBefore.length}`);
  issuesBefore.forEach((i) => console.log(`  - [${i.area}] ${i.message}`));

  detail = await getProjectDetail(project.id);
  console.log("\nhealth after some progress:", detail!.healthScore);

  console.log("\n--- Shopify + Klaviyo project (different tech combo) ---");
  const project2 = await createProjectWithWorkflow({
    clientId: client.id,
    name: "Smoke Test — Shopify Store",
    projectType: "Shopify Store",
    technologyKeys: ["shopify", "klaviyo"],
  });
  const detail2 = await getProjectDetail(project2.id);
  console.log(`shopify+klaviyo stages: ${detail2!.stages.map((s) => s.key).join(", ")}`);
  console.log(`shopify+klaviyo task count: ${detail2!.tasks.length}`);

  console.log("\nSmoke test complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
