import { listMaintenancePlans, DEFAULT_MAINTENANCE_CHECKLIST } from "@/lib/queries/maintenance";
import { listProjects } from "@/lib/queries/projects";
import { CreateMaintenancePlanForm } from "@/components/create-maintenance-plan-form";
import { MaintenanceStatRow } from "@/components/maintenance-stat-row";
import { MaintenanceViewSwitcher } from "@/components/maintenance-view-switcher";
import { MaintenanceToolbar } from "@/components/maintenance-toolbar";
import { MaintenanceClientCard } from "@/components/maintenance-client-card";
import { MaintenanceTable } from "@/components/maintenance-table";
import { MaintenancePagination } from "@/components/maintenance-pagination";
import { requireAuth } from "@/lib/auth";

type Plan = Awaited<ReturnType<typeof listMaintenancePlans>>[number];

function isDue(plan: Plan): boolean {
  return plan.isActive && new Date(plan.nextDueAt) <= new Date();
}

function sortPlans(plans: Plan[], sort: string): Plan[] {
  const sorted = [...plans];
  switch (sort) {
    case "client":
      sorted.sort((a, b) => a.clientName.localeCompare(b.clientName));
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "cadence":
      sorted.sort((a, b) => a.cadenceDays - b.cadenceDays);
      break;
    case "lastGenerated":
      sorted.sort((a, b) => {
        const at = a.lastGeneratedAt ? new Date(a.lastGeneratedAt).getTime() : 0;
        const bt = b.lastGeneratedAt ? new Date(b.lastGeneratedAt).getTime() : 0;
        return bt - at;
      });
      break;
    case "due":
    default:
      sorted.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
      break;
  }
  return sorted;
}

function groupPlans(plans: Plan[], group: string): { label: string; items: Plan[] }[] {
  if (group === "client") {
    const byClient = new Map<string, Plan[]>();
    for (const p of plans) {
      if (!byClient.has(p.clientName)) byClient.set(p.clientName, []);
      byClient.get(p.clientName)!.push(p);
    }
    return Array.from(byClient.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }
  if (group === "project") {
    const byProject = new Map<string, Plan[]>();
    for (const p of plans) {
      if (!byProject.has(p.projectName)) byProject.set(p.projectName, []);
      byProject.get(p.projectName)!.push(p);
    }
    return Array.from(byProject.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }
  if (group === "status") {
    const buckets: Record<string, Plan[]> = { "Due Now": [], Active: [], Paused: [] };
    for (const p of plans) {
      if (isDue(p)) buckets["Due Now"].push(p);
      else if (p.isActive) buckets.Active.push(p);
      else buckets.Paused.push(p);
    }
    return Object.entries(buckets)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }
  if (group === "payment") {
    const buckets: Record<string, Plan[]> = { Unpaid: [], Paid: [] };
    for (const p of plans) (p.isPaid ? buckets.Paid : buckets.Unpaid).push(p);
    return Object.entries(buckets)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }
  return [{ label: "", items: plans }];
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    group?: string;
    project?: string;
    view?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { organizationId } = await requireAuth();
  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const sort = params.sort ?? "due";
  const group = params.group ?? "none";
  const projectFilter = params.project ?? "";
  const view = params.view ?? "cards";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = [10, 25, 50].includes(parseInt(params.pageSize ?? "10", 10))
    ? parseInt(params.pageSize ?? "10", 10)
    : 10;

  const searchParamsString = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ).toString();

  const [plans, projects] = await Promise.all([listMaintenancePlans(organizationId), listProjects(organizationId)]);

  const activePlans = plans.filter((p) => p.isActive);
  const duePlans = activePlans.filter(isDue);
  const pausedPlans = plans.filter((p) => !p.isActive);
  const unpaidPlans = plans.filter((p) => !p.isPaid);
  const byClientAll = new Set(plans.map((p) => p.clientName));

  const statusCounts: Record<string, number> = {
    all: plans.length,
    ACTIVE: activePlans.length - duePlans.length,
    DUE: duePlans.length,
    PAUSED: pausedPlans.length,
    UNPAID: unpaidPlans.length,
  };
  const projectOptions = Array.from(new Set(plans.map((p) => p.projectName))).sort();

  let filtered = plans;
  if (statusFilter === "ACTIVE") filtered = filtered.filter((p) => p.isActive && !isDue(p));
  else if (statusFilter === "DUE") filtered = filtered.filter(isDue);
  else if (statusFilter === "PAUSED") filtered = filtered.filter((p) => !p.isActive);
  else if (statusFilter === "UNPAID") filtered = filtered.filter((p) => !p.isPaid);
  if (projectFilter) filtered = filtered.filter((p) => p.projectName === projectFilter);
  filtered = sortPlans(filtered, sort);

  // Cards is always grouped by client — the Group control only changes
  // anything for List.
  const isGrouped = view === "list" && group !== "none";
  const groups = isGrouped ? groupPlans(filtered, group) : null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Maintenance</h1>
          <p className="text-md text-muted-foreground">
            Recurring retainer checklists, grouped by client — separate from the one-time build workflow. No
            automatic cron runs these; generate each cycle by hand when it&apos;s due.
          </p>
        </div>
        <CreateMaintenancePlanForm projects={projects} defaultChecklist={DEFAULT_MAINTENANCE_CHECKLIST} />
      </div>

      <MaintenanceStatRow
        totalPlans={plans.length}
        activePlans={activePlans.length}
        dueNow={duePlans.length}
        unpaid={unpaidPlans.length}
        clientsOnRetainer={byClientAll.size}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MaintenanceToolbar
          status={statusFilter}
          statusCounts={statusCounts}
          sort={sort}
          group={group}
          project={projectFilter}
          projectOptions={projectOptions}
          view={view}
        />
        <MaintenanceViewSwitcher active={view} searchParamsString={searchParamsString} />
      </div>

      {plans.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No maintenance plans yet. Create one for any client on a retainer.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No plans match these filters.</p>
        </div>
      ) : view === "list" ? (
        groups ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.label}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label} <span className="font-normal normal-case">· {g.items.length}</span>
                </h2>
                <MaintenanceTable plans={g.items} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <MaintenanceTable plans={pageItems} />
            <MaintenancePagination
              page={clampedPage}
              pageSize={pageSize}
              totalCount={filtered.length}
              searchParamsString={searchParamsString}
            />
          </>
        )
      ) : (
        // Cards: grouped by client, oldest-due client first — MaintenanceClientCard
        // does its own project sub-grouping internally.
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupPlans(filtered, "client")
            .map((g) => ({
              ...g,
              dueCount: g.items.filter(isDue).length,
            }))
            .sort((a, b) => b.dueCount - a.dueCount)
            .map((g) => (
              <MaintenanceClientCard key={g.label} clientName={g.label} plans={g.items} />
            ))}
        </div>
      )}
    </div>
  );
}
