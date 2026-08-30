import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin, getOrganizationById } from "@/lib/queries/organizations";
import { listClients } from "@/lib/queries/clients";
import { listProjects, listAllTasks } from "@/lib/queries/projects";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;

  const org = await getOrganizationById(id);
  if (!org) notFound();

  // Reuses the exact same org-scoped query functions every normal page
  // calls with the caller's own organizationId — here called with the
  // organization being inspected instead, since requirePlatformAdmin()
  // already gated the whole page. No separate "admin" query logic to
  // duplicate or drift out of sync with the real thing.
  const [clientsList, projectsList, allTasks] = await Promise.all([
    listClients(id),
    listProjects(id),
    listAllTasks(id),
  ]);

  const topLevelTasksByProject = new Map<string, { done: number; total: number }>();
  for (const t of allTasks) {
    if (t.parentTaskId) continue;
    const entry = topLevelTasksByProject.get(t.projectId) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (t.effectiveStatus === "DONE") entry.done += 1;
    topLevelTasksByProject.set(t.projectId, entry);
  }

  return (
    <div className="max-w-4xl">
      <Link href="/admin" className="mb-3 inline-block text-xs font-medium text-link hover:underline">
        ← All organizations
      </Link>
      <h1 className="mb-1 text-xl font-semibold">{org.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {org.slug} · joined {formatDate(org.createdAt)} · read-only view
      </p>

      <h2 className="mb-2 text-sm font-semibold text-[#52514e]">
        Clients ({clientsList.length})
      </h2>
      <div className="mb-6 divide-y divide-border rounded-xl border border-border bg-card">
        {clientsList.length === 0 ? (
          <p className="px-5 py-3.5 text-sm text-muted-foreground">No clients yet.</p>
        ) : (
          clientsList.map((c) => (
            <div key={c.id} className="px-5 py-3 text-sm">
              <div className="font-medium">{c.name}</div>
              {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
            </div>
          ))
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-[#52514e]">
        Projects ({projectsList.length})
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {projectsList.length === 0 ? (
          <p className="px-5 py-3.5 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          projectsList.map((p) => {
            const stats = topLevelTasksByProject.get(p.id) ?? { done: 0, total: 0 };
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.clientName} · {p.projectType} · {p.status}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {stats.done}/{stats.total} tasks done
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
