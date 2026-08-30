import Link from "next/link";
import { FolderIcon, ArrowUpRightIcon } from "lucide-react";
import { MaintenancePlanItem } from "@/components/maintenance-plan-item";
import { hashPick } from "@/lib/hash-color";
import { PROJECT_COLOR_PALETTE } from "@/lib/project-display";

type Plan = Parameters<typeof MaintenancePlanItem>[0]["plan"] & { projectId: string; projectName: string };

/**
 * One card per client — every maintenance plan across every one of their
 * projects, grouped by project so a client with both a WordPress site and a
 * Shopify store (each on its own retainer) reads as two clearly-labeled
 * sections inside one client card, not as disconnected rows or separate
 * per-plan cards.
 */
export function MaintenanceClientCard({ clientName, plans }: { clientName: string; plans: Plan[] }) {
  const dueCount = plans.filter((p) => p.isActive && new Date(p.nextDueAt) <= new Date()).length;
  const activeCount = plans.filter((p) => p.isActive).length;
  const avatarColor = hashPick(clientName, PROJECT_COLOR_PALETTE);

  const byProject = new Map<string, Plan[]>();
  for (const plan of plans) {
    if (!byProject.has(plan.projectName)) byProject.set(plan.projectName, []);
    byProject.get(plan.projectName)!.push(plan);
  }
  const projectGroups = Array.from(byProject.entries());

  // A client whose only project shares its exact name (the common case for
  // a solo site, vs. an agency client with several separately-named
  // properties) doesn't need its own project sub-heading — "FLPB" directly
  // under "FLPB" just reads as a rendering mistake, not real information.
  // "View project" moves up into the client header instead of disappearing.
  const soleProjectMatchesClient =
    projectGroups.length === 1 && projectGroups[0][0].trim().toLowerCase() === clientName.trim().toLowerCase();

  return (
    <div className="app-card p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {clientName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{clientName}</h2>
            <p className="text-xs text-muted-foreground">
              {plans.length} plan{plans.length === 1 ? "" : "s"} · {activeCount} active
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dueCount > 0 && (
            <span className="rounded-full bg-[#fef4de] px-2 py-0.5 text-xs font-bold text-[#8a5c00]">
              {dueCount} due
            </span>
          )}
          {soleProjectMatchesClient && (
            <Link
              href={`/projects/${projectGroups[0][1][0].projectId}`}
              className="flex items-center gap-1 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-link hover:bg-muted"
            >
              View project <ArrowUpRightIcon className="size-3" />
            </Link>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {projectGroups.map(([projectName, projectPlans]) => (
          <div key={projectName} className="py-3">
            {!soleProjectMatchesClient && (
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <FolderIcon className="size-3.5" />
                  {projectName}
                </div>
                <Link
                  href={`/projects/${projectPlans[0].projectId}`}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-link hover:bg-muted"
                >
                  View project <ArrowUpRightIcon className="size-3" />
                </Link>
              </div>
            )}
            <div className={`divide-y divide-border ${soleProjectMatchesClient ? "" : "pl-5"}`}>
              {projectPlans.map((plan) => (
                <MaintenancePlanItem key={plan.id} plan={plan} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
