import { notFound } from "next/navigation";
import { getClientWorkspaceOverview } from "@/lib/queries/projects";
import { getClientVisibleFiles, listProjectMessages } from "@/lib/queries/projects";
import { ProjectTabs } from "@/components/project-tabs";
import { PortalComments } from "@/components/portal-comments";
import { PortalFiles } from "@/components/portal-files";
import { ClientSettingsTab } from "@/components/client-settings-tab";
import { markClientActionDoneAction } from "@/lib/actions";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientWorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const overview = await getClientWorkspaceOverview(token);
  if (!overview) notFound();
  const { client, projectSummaries } = overview;

  const [projectFiles, projectThreads] = await Promise.all([
    Promise.all(projectSummaries.map((s) => getClientVisibleFiles(s.project.id))),
    Promise.all(
      projectSummaries.map(async (s) => ({
        id: s.project.id,
        name: s.project.name,
        messages: await listProjectMessages(s.project.id, s.project.organizationId!),
      }))
    ),
  ]);
  const totalFiles = projectFiles.reduce((sum, f) => sum + f.length, 0);

  const overviewContent = (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Welcome back, {client.company || client.name} 👋</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectSummaries.length === 0
            ? "Waiting on your first project"
            : "Here's the current status of your project" + (projectSummaries.length === 1 ? "." : "s.")}
        </p>
      </div>

      {projectSummaries.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-[#0ca30c]/30 bg-[#eafaea] p-4">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ca30c] text-xs font-bold text-white">✓</span>
          <div>
            <strong className="block text-sm">You&apos;re all set, {client.name.split(" ")[0]}.</strong>
            <p className="mt-0.5 text-xs text-[#52514e]">
              Paul has your info on file and is setting up your first project — usually within a business day. Feel
              free to leave a comment below if you have questions in the meantime.
            </p>
          </div>
        </div>
      ) : (
        projectSummaries.map((s) => (
          <section key={s.project.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold">{s.project.name}</h2>

            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#52514e]">Progress</span>
              <span className="font-bold">{s.percent}%</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground">Current stage</div>
                <div className="text-sm font-bold">{s.currentStageName ?? "Complete"}</div>
              </div>
              {s.project.targetLaunchDate && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground">Estimated completion</div>
                  <div className="text-sm font-bold">{formatDate(s.project.targetLaunchDate)}</div>
                </div>
              )}
            </div>

            {(s.recentlyCompleted.length > 0 || s.nextUp) && (
              <div className="mb-4">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent updates</h3>
                <ul className="space-y-1 text-sm">
                  {s.recentlyCompleted.map((title, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-[#0ca30c]">✓</span> {title}
                    </li>
                  ))}
                  {s.nextUp && (
                    <li className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-primary">→</span> {s.nextUp}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {s.clientActions.length > 0 && (
              <div className="rounded-lg border border-[#2a78d6]/25 bg-[#eef2fb] p-3.5">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Your action</h3>
                <ul className="space-y-2">
                  {s.clientActions.map((action) => (
                    <li key={action.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{action.title}</span>
                      <form action={markClientActionDoneAction}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="projectId" value={s.project.id} />
                        <input type="hidden" name="taskId" value={action.id} />
                        <button type="submit" className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                          Review
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))
      )}

      <PortalComments token={token} projects={projectThreads} />
    </div>
  );

  const filesContent = (
    <div className="space-y-4">
      {projectSummaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet — they&apos;ll show up here once your project gets started.</p>
      ) : (
        projectSummaries.map((s, i) => (
          <div key={s.project.id}>
            {projectSummaries.length > 1 && <h2 className="mb-2 text-sm font-bold">{s.project.name}</h2>}
            <PortalFiles token={token} projectId={s.project.id} initialFiles={projectFiles[i]} mode="full" />
          </div>
        ))
      )}
    </div>
  );

  const settingsContent = <ClientSettingsTab token={token} client={client} />;

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 text-lg font-bold">
          DEV<span className="text-primary">OS</span>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">Client workspace</p>

        <ProjectTabs
          tabs={[
            { label: "Overview", slug: "overview", content: overviewContent },
            { label: "Files", slug: "files", badge: totalFiles || undefined, content: filesContent },
            { label: "Settings", slug: "settings", content: settingsContent },
          ]}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This link is private to you — only people who have it can view or add to it.
        </p>
      </div>
    </div>
  );
}
