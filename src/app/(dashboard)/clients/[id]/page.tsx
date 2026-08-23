import Link from "next/link";
import { notFound } from "next/navigation";
import { MailIcon, PhoneIcon } from "lucide-react";
import { getClient } from "@/lib/queries/clients";
import {
  listAllTasks,
  listProjectsForSwitcher,
  deriveProjectCardSummaries,
  listProjectAttachments,
  listProjectMessages,
} from "@/lib/queries/projects";
import { ProjectCard, type ProjectCardData } from "@/components/project-card";
import { DeleteButton } from "@/components/delete-button";
import { ClientPortalLinkPanel } from "@/components/client-portal-link-panel";
import { deleteClientAction } from "@/lib/actions";
import { hashPick } from "@/lib/hash-color";
import { PROJECT_COLOR_PALETTE } from "@/lib/project-display";
import { requireAuth } from "@/lib/auth";

function daysToLaunch(targetLaunchDate: Date | string | null): number | null {
  if (!targetLaunchDate) return null;
  return Math.round(
    (new Date(targetLaunchDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireAuth();
  const { id } = await params;
  const client = await getClient(id, organizationId);
  if (!client) notFound();

  const [allTasks, switcherProjects] = await Promise.all([listAllTasks(organizationId), listProjectsForSwitcher(organizationId)]);

  const technologiesByProject = new Map(switcherProjects.map((p) => [p.id, p.technologyNames]));
  const createdAtByProject = new Map(client.projects.map((p) => [p.id, p.createdAt]));
  const summaryByProject = deriveProjectCardSummaries(allTasks, createdAtByProject);

  const projectCards: ProjectCardData[] = client.projects.map((p) => ({
    id: p.id,
    name: p.name,
    projectType: p.projectType,
    status: p.status,
    healthScore: p.healthScore,
    clientName: client.name,
    clientId: client.id,
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

  const avatarColor = hashPick(client.name, PROJECT_COLOR_PALETTE);
  const showCompany = client.company && client.company.trim().toLowerCase() !== client.name.trim().toLowerCase();

  const [fileLists, messageLists] = await Promise.all([
    Promise.all(client.projects.map((p) => listProjectAttachments(p.id, organizationId))),
    Promise.all(client.projects.map((p) => listProjectMessages(p.id, organizationId))),
  ]);
  const clientFileCount = fileLists.reduce((sum, files) => sum + files.filter((f) => f.uploadedByClient).length, 0);
  const clientMessageCount = messageLists.reduce((sum, msgs) => sum + msgs.length, 0);

  return (
    <div className="w-full">
      <Link href="/clients" className="mb-3 inline-block text-xs font-medium text-primary hover:underline">
        ← All clients
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {client.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {showCompany && <span>{client.company}</span>}
              {client.contactEmail && (
                <span className="flex items-center gap-1">
                  <MailIcon className="size-3.5" /> {client.contactEmail}
                </span>
              )}
              {client.contactPhone && (
                <span className="flex items-center gap-1">
                  <PhoneIcon className="size-3.5" /> {client.contactPhone}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/projects/new?clientId=${client.id}`}
          className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + New project for {client.name}
        </Link>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-[#52514e]">
        Projects <span className="font-normal text-muted-foreground">· {client.projects.length}</span>
      </h2>
      {projectCards.length === 0 ? (
        <div className="app-card mb-6 p-8 text-center">
          <p className="text-sm text-muted-foreground">No projects yet for this client.</p>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectCards.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <div className="mb-6">
        <ClientPortalLinkPanel
          clientId={client.id}
          token={client.portalToken}
          fileCount={clientFileCount}
          messageCount={clientMessageCount}
        />
      </div>

      <div className="rounded-lg border border-[#f3d4d4] bg-[#fdf5f5] p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#d03b3b]">Danger Zone</h2>
        {client.projects.length === 0 ? (
          <DeleteButton action={deleteClientAction.bind(null, client.id)} label="Delete client" />
        ) : (
          <p className="text-xs text-muted-foreground">
            Delete this client&apos;s {client.projects.length} project{client.projects.length === 1 ? "" : "s"} first
            to delete the client.
          </p>
        )}
      </div>
    </div>
  );
}
