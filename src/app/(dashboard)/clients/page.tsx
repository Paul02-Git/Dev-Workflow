import { listClients } from "@/lib/queries/clients";
import { getIntakeToken } from "@/lib/queries/agency-settings";
import { IntakeLinkPanel } from "@/components/intake-link-panel";
import { listProjects, listAllTasks, deriveProjectCardSummaries } from "@/lib/queries/projects";
import { listMaintenancePlans } from "@/lib/queries/maintenance";
import { healthState } from "@/components/project-pulse-cards";
import { CreateClientForm } from "@/components/create-client-form";
import { ClientsSection } from "@/components/clients-section";
import type { ClientCardData } from "@/components/client-card";
import { ClientsSidebar, type NeedsAttentionItem } from "@/components/clients-sidebar";

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
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = params.filter === "new" ? "new" : "all";

  const [clients, projects, allTasks, maintenancePlans, intakeToken] = await Promise.all([
    listClients(),
    listProjects(),
    listAllTasks(),
    listMaintenancePlans(),
    getIntakeToken(),
  ]);

  const createdAtByProject = new Map(projects.map((p) => [p.id, p.createdAt]));
  const summaryByProject = deriveProjectCardSummaries(allTasks, createdAtByProject);

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
    };
  });

  const newCount = clients.filter((c) => isNewClient(c.createdAt)).length;

  let tabFiltered = cards;
  if (activeFilter === "new") {
    const newIds = new Set(clients.filter((c) => isNewClient(c.createdAt)).map((c) => c.id));
    tabFiltered = tabFiltered.filter((c) => newIds.has(c.id));
  }

  // Sidebar rollups are portfolio-wide — they intentionally ignore the
  // filter/search above, since "how's the whole client base doing" is a
  // different question than "what does this filtered view show."
  const activeProjectCount = projects.filter((p) => p.status === "ACTIVE").length;
  const otherProjectCount = projects.length - activeProjectCount;

  const needsAttention: NeedsAttentionItem[] = cards
    .map((c) => {
      const clientProjects = projectsByClient.get(c.id) ?? [];
      const flaggedCount = clientProjects.filter((p) => {
        const summary = summaryByProject.get(p.id);
        return summary && (summary.issues.length > 0 || summary.blockedTaskTitle);
      }).length;
      if (flaggedCount === 0) return null;
      return {
        clientId: c.id,
        clientName: c.name,
        reason: `${flaggedCount} project${flaggedCount === 1 ? "" : "s"} need${flaggedCount === 1 ? "s" : ""} attention`,
      };
    })
    .filter((x): x is NeedsAttentionItem => x !== null)
    .slice(0, 5);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Clients</h1>
          <p className="text-md text-muted-foreground">
            {clients.length} client{clients.length === 1 ? "" : "s"} across your whole book of work
          </p>
        </div>
        <CreateClientForm />
      </div>

      <div className="mb-4">
        <IntakeLinkPanel token={intakeToken} />
      </div>

      <div className="flex w-full flex-col items-start gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          {clients.length === 0 ? (
            <div className="app-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No clients yet — add your first one above.</p>
            </div>
          ) : (
            <ClientsSection cards={tabFiltered} activeFilter={activeFilter} allCount={clients.length} newCount={newCount} />
          )}
        </div>

        <ClientsSidebar
          activeProjectCount={activeProjectCount}
          otherProjectCount={otherProjectCount}
          clientsOnRetainerCount={retainerClientIds.size}
          clientsTotal={clients.length}
          needsAttention={needsAttention}
        />
      </div>
    </div>
  );
}
