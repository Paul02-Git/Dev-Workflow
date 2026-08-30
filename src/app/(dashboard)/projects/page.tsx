import Link from "next/link";
import {
  listProjects,
  listAllTasks,
  listProjectsForSwitcher,
  deriveProjectCardSummaries,
} from "@/lib/queries/projects";
import type { ProjectCardData } from "@/components/project-card";
import { ProjectsStatRow } from "@/components/projects-stat-row";
import { ProjectsViewSwitcher } from "@/components/projects-view-switcher";
import { ProjectsToolbar } from "@/components/projects-toolbar";
import { ProjectsTable } from "@/components/projects-table";
import { ProjectsPagination } from "@/components/projects-pagination";
import { ProjectCard } from "@/components/project-card";
import { STATUS_LABEL } from "@/lib/project-display";
import { requireAuth } from "@/lib/auth";

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, ON_HOLD: 1, LAUNCHED: 2, ARCHIVED: 3 };
const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function daysToLaunch(targetLaunchDate: Date | string | null): number | null {
  if (!targetLaunchDate) return null;
  return Math.round(
    (new Date(targetLaunchDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
}

function sortProjects(cards: ProjectCardData[], sort: string): ProjectCardData[] {
  const sorted = [...cards];
  switch (sort) {
    case "deadline":
      sorted.sort((a, b) => {
        if (a.daysToLaunch === null) return 1;
        if (b.daysToLaunch === null) return -1;
        return a.daysToLaunch - b.daysToLaunch;
      });
      break;
    case "health":
      // Ascending — the most at-risk project is the one most worth seeing
      // first, not the healthiest.
      sorted.sort((a, b) => a.healthScore - b.healthScore);
      break;
    case "priority":
      sorted.sort((a, b) => {
        const aw = a.summary.nextAction ? PRIORITY_WEIGHT[a.summary.nextAction.priority] ?? 9 : 9;
        const bw = b.summary.nextAction ? PRIORITY_WEIGHT[b.summary.nextAction.priority] ?? 9 : 9;
        return aw - bw;
      });
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "created":
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }
  return sorted;
}

function groupProjects(cards: ProjectCardData[], group: string): { label: string; items: ProjectCardData[] }[] {
  if (group === "status") {
    const byStatus = new Map<string, ProjectCardData[]>();
    for (const c of cards) {
      if (!byStatus.has(c.status)) byStatus.set(c.status, []);
      byStatus.get(c.status)!.push(c);
    }
    return Array.from(byStatus.entries())
      .sort(([a], [b]) => (STATUS_ORDER[a] ?? 9) - (STATUS_ORDER[b] ?? 9))
      .map(([status, items]) => ({ label: STATUS_LABEL[status]?.label ?? status, items }));
  }
  if (group === "client") {
    const byClient = new Map<string, ProjectCardData[]>();
    for (const c of cards) {
      if (!byClient.has(c.clientName)) byClient.set(c.clientName, []);
      byClient.get(c.clientName)!.push(c);
    }
    return Array.from(byClient.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clientName, items]) => ({ label: clientName, items }));
  }
  return [{ label: "", items: cards }];
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    group?: string;
    tech?: string;
    view?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { organizationId } = await requireAuth();
  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const sort = params.sort ?? "created";
  const group = params.group ?? "none";
  const techFilter = params.tech ?? "";
  const view = params.view ?? "list";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = [10, 25, 50].includes(parseInt(params.pageSize ?? "10", 10))
    ? parseInt(params.pageSize ?? "10", 10)
    : 10;

  const searchParamsString = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ).toString();

  const [projects, allTasks, switcherProjects] = await Promise.all([
    listProjects(organizationId),
    listAllTasks(organizationId),
    listProjectsForSwitcher(organizationId),
  ]);

  const technologiesByProject = new Map(switcherProjects.map((p) => [p.id, p.technologyNames]));
  const createdAtByProject = new Map(projects.map((p) => [p.id, p.createdAt]));
  const summaryByProject = deriveProjectCardSummaries(allTasks, createdAtByProject);

  const allCards: ProjectCardData[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    projectType: p.projectType,
    status: p.status,
    healthScore: p.healthScore,
    clientName: p.clientName,
    clientId: p.clientId,
    domain: p.domain,
    createdAt: p.createdAt,
    targetLaunchDate: p.targetLaunchDate,
    launchedAt: p.launchedAt,
    daysToLaunch: daysToLaunch(p.targetLaunchDate),
    technologyNames: technologiesByProject.get(p.id) ?? [],
    summary: summaryByProject.get(p.id) ?? {
      tasksDone: 0,
      tasksTotal: 0,
      criticalDone: 0,
      criticalTotal: 0,
      blockedTaskTitle: null,
      waitingTaskTitle: null,
      nextAction: null,
      issues: [],
    },
  }));

  const statusCounts: Record<string, number> = { all: allCards.length };
  for (const c of allCards) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;

  const technologyOptions = Array.from(new Set(allCards.flatMap((c) => c.technologyNames))).sort();

  const activeCards = allCards.filter((c) => c.status === "ACTIVE");
  const avgActiveHealth =
    activeCards.length > 0
      ? Math.round(activeCards.reduce((sum, c) => sum + c.healthScore, 0) / activeCards.length)
      : null;
  const launchingSoonCount = activeCards.filter(
    (c) => c.daysToLaunch !== null && c.daysToLaunch >= 0 && c.daysToLaunch <= 7
  ).length;

  let filtered = statusFilter === "all" ? allCards : allCards.filter((c) => c.status === statusFilter);
  if (techFilter) filtered = filtered.filter((c) => c.technologyNames.includes(techFilter));
  filtered = sortProjects(filtered, sort);

  const groups = group !== "none" ? groupProjects(filtered, group) : null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Projects</h1>
          <p className="text-md text-muted-foreground">
            {allCards.length} project{allCards.length === 1 ? "" : "s"} across every client
          </p>
        </div>
        <Link
          href="/projects/new"
          className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          + New Project
        </Link>
      </div>

      <ProjectsStatRow
        totalCount={allCards.length}
        activeCount={activeCards.length}
        avgActiveHealth={avgActiveHealth}
        launchingSoonCount={launchingSoonCount}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ProjectsToolbar
          status={statusFilter}
          statusCounts={statusCounts}
          sort={sort}
          group={group}
          tech={techFilter}
          technologyOptions={technologyOptions}
        />
        <ProjectsViewSwitcher active={view} searchParamsString={searchParamsString} />
      </div>

      {allCards.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No projects yet.{" "}
            <Link href="/projects/new" className="font-semibold text-link hover:underline">
              Create your first one
            </Link>
            .
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No projects match these filters.</p>
        </div>
      ) : view === "cards" ? (
        groups ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.label}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label} <span className="font-normal normal-case">· {g.items.length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )
      ) : groups ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {g.label} <span className="font-normal normal-case">· {g.items.length}</span>
              </h2>
              <ProjectsTable projects={g.items} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ProjectsTable projects={pageItems} />
          <ProjectsPagination
            page={clampedPage}
            pageSize={pageSize}
            totalCount={filtered.length}
            searchParamsString={searchParamsString}
          />
        </>
      )}
    </div>
  );
}
