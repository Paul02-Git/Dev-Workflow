import { listClients } from "@/lib/queries/clients";
import { getIntakeToken } from "@/lib/queries/agency-settings";
import { IntakeLinkPanel } from "@/components/intake-link-panel";
import { listProjects } from "@/lib/queries/projects";
import { listMaintenancePlans } from "@/lib/queries/maintenance";
import { requireAuth } from "@/lib/auth";
import { healthState } from "@/components/project-pulse-cards";
import { CreateClientForm } from "@/components/create-client-form";
import { ClientsFilterTabs, type ClientsTabKey } from "@/components/clients-filter-tabs";
import { ClientsSearchBox } from "@/components/clients-search-box";
import { ClientsViewSwitcher } from "@/components/clients-view-switcher";
import { ClientsTable } from "@/components/clients-table";
import { ClientsPagination } from "@/components/clients-pagination";
import { ClientCard, type ClientCardData } from "@/components/client-card";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isNewClient(createdAt: Date | string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= THIRTY_DAYS_MS;
}

function isFutureDate(date: Date | string): boolean {
  return new Date(date).getTime() >= Date.now();
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; view?: string; page?: string; pageSize?: string }>;
}) {
  const { organizationId } = await requireAuth();
  const params = await searchParams;
  const activeFilter: ClientsTabKey =
    params.filter === "new" || params.filter === "active" || params.filter === "completed" ? params.filter : "all";
  const query = (params.q ?? "").trim().toLowerCase();
  const view = params.view ?? "list";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = [15, 25, 50].includes(parseInt(params.pageSize ?? "15", 10))
    ? parseInt(params.pageSize ?? "15", 10)
    : 15;

  const searchParamsString = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ).toString();

  const [clients, projects, maintenancePlans, intakeToken] = await Promise.all([
    listClients(organizationId),
    listProjects(organizationId),
    listMaintenancePlans(organizationId),
    getIntakeToken(organizationId),
  ]);

  const projectsByClient = new Map<string, typeof projects>();
  for (const p of projects) {
    if (!projectsByClient.has(p.clientId)) projectsByClient.set(p.clientId, []);
    projectsByClient.get(p.clientId)!.push(p);
  }

  const retainerClientIds = new Set(maintenancePlans.filter((p) => p.isActive).map((p) => p.clientId));

  const cards: ClientCardData[] = clients.map((c) => {
    const clientProjects = projectsByClient.get(c.id) ?? [];
    const activeProjects = clientProjects.filter((p) => p.status === "ACTIVE");
    const healthSource = activeProjects.length > 0 ? activeProjects : clientProjects;
    const avgHealth =
      healthSource.length > 0
        ? Math.round(healthSource.reduce((sum, p) => sum + p.healthScore, 0) / healthSource.length)
        : null;
    const health = avgHealth !== null ? healthState(avgHealth) : { label: "—", color: "#898781" };

    const upcomingLaunch = clientProjects
      .map((p) => p.targetLaunchDate)
      .filter((d): d is NonNullable<typeof d> => !!d && isFutureDate(d))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

    const hasActive = activeProjects.length > 0;
    const hasCompleted = clientProjects.some((p) => p.status === "LAUNCHED") && !hasActive;
    const status = hasActive
      ? { label: "Actively Working", className: "bg-[#eef2fb] text-[#2a4d8f]" }
      : hasCompleted
        ? { label: "Completed", className: "bg-[#eafaea] text-[#0ca30c]" }
        : isNewClient(c.createdAt)
          ? { label: "New", className: "bg-[#fef4de] text-[#8a5c00]" }
          : { label: "No projects", className: "bg-black/5 text-muted-foreground" };

    return {
      id: c.id,
      name: c.name,
      company: c.company,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      projectCount: clientProjects.length,
      healthLabel: health.label,
      healthColor: health.color,
      nextLaunchDate: upcomingLaunch,
      onRetainer: retainerClientIds.has(c.id),
      source: c.source,
      createdAt: c.createdAt,
      statusLabel: status.label,
      statusClassName: status.className,
      sourceLabel: c.source === "intake" ? "Intake form" : "Manual",
    };
  });

  const newCount = clients.filter((c) => isNewClient(c.createdAt)).length;

  const activelyWorkingIds = new Set(
    clients.filter((c) => (projectsByClient.get(c.id) ?? []).some((p) => p.status === "ACTIVE")).map((c) => c.id)
  );
  const completedIds = new Set(
    clients
      .filter((c) => {
        const clientProjects = projectsByClient.get(c.id) ?? [];
        return clientProjects.some((p) => p.status === "LAUNCHED") && !clientProjects.some((p) => p.status === "ACTIVE");
      })
      .map((c) => c.id)
  );

  const tabCounts: Record<ClientsTabKey, number> = {
    all: clients.length,
    new: newCount,
    active: activelyWorkingIds.size,
    completed: completedIds.size,
  };

  let filtered = cards;
  if (activeFilter === "new") {
    const newIds = new Set(clients.filter((c) => isNewClient(c.createdAt)).map((c) => c.id));
    filtered = filtered.filter((c) => newIds.has(c.id));
  } else if (activeFilter === "active") {
    filtered = filtered.filter((c) => activelyWorkingIds.has(c.id));
  } else if (activeFilter === "completed") {
    filtered = filtered.filter((c) => completedIds.has(c.id));
  }
  if (query) {
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.company ?? "").toLowerCase().includes(query) ||
        (c.contactEmail ?? "").toLowerCase().includes(query)
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Clients</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ClientsViewSwitcher active={view} searchParamsString={searchParamsString} />
          <CreateClientForm />
        </div>
      </div>

      <div className="min-w-0">
        {clients.length === 0 ? (
          <div className="app-card space-y-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">No clients yet, add your first one above.</p>
            <div className="flex justify-center">
              <IntakeLinkPanel token={intakeToken} />
            </div>
          </div>
        ) : (
          <>
            <ClientsFilterTabs
              active={activeFilter}
              counts={tabCounts}
              right={
                <>
                  <IntakeLinkPanel token={intakeToken} />
                  <ClientsSearchBox initialQuery={params.q ?? ""} />
                </>
              }
            />

            {filtered.length === 0 ? (
              <div className="app-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No clients match these filters.</p>
              </div>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filtered.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            ) : (
              <>
                <ClientsTable clients={pageItems} />
                <ClientsPagination
                  page={clampedPage}
                  pageSize={pageSize}
                  totalCount={filtered.length}
                  searchParamsString={searchParamsString}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
