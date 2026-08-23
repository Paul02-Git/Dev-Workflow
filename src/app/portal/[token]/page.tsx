import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientPortalDashboard } from "@/lib/queries/clients";
import { listProjectMessages } from "@/lib/queries/projects";
import { ClientInfoModal } from "@/components/client-info-modal";
import { PortalComments } from "@/components/portal-comments";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "In progress",
  ON_HOLD: "On hold",
  LAUNCHED: "Live",
  ARCHIVED: "Archived",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dashboard = await getClientPortalDashboard(token);
  if (!dashboard) notFound();
  const { client, projects } = dashboard;

  const projectThreads = await Promise.all(
    projects.map(async (p) => ({ id: p.id, name: p.name, messages: await listProjectMessages(p.id) }))
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div>
              <h1 className="text-xl font-bold">{client.company || client.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {projects.length === 0
                  ? "Waiting on your first project"
                  : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <ClientInfoModal token={token} client={client} />
          </div>
        </div>

        {projects.length === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#0ca30c]/30 bg-[#eafaea] p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ca30c] text-xs font-bold text-white">✓</span>
            <div>
              <strong className="block text-sm">You&apos;re all set, {client.name.split(" ")[0]}.</strong>
              <p className="mt-0.5 text-xs text-[#52514e]">
                Paul has your info on file and is setting up your first project — usually within a business day. Feel
                free to leave a comment if you have questions in the meantime.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold">Your projects</h2>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-black/15 bg-background p-6 text-center text-sm text-muted-foreground">
                Nothing here yet — Paul&apos;s setting up your first project now.
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => {
                  const percent = p.tasksTotal > 0 ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/portal/${token}/projects/${p.id}`}
                      className="block rounded-lg border border-black/10 bg-background p-3.5 hover:border-primary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.projectType}</div>
                        </div>
                        <span className="rounded-full bg-[#fef4de] px-2 py-0.5 text-[10.5px] font-bold text-[#c9720a]">
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-[#0ca30c]" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                        <span>{percent}% complete</span>
                        {p.targetLaunchDate && <span>Target {formatDate(p.targetLaunchDate)}</span>}
                      </div>
                      <div className="mt-2 text-[11px] font-bold text-primary">View project →</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <PortalComments token={token} projects={projectThreads} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This link is private to you — only people who have it can view or add to it.
        </p>
      </div>
    </div>
  );
}
