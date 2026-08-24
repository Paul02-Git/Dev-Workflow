import { redirect } from "next/navigation";
import { requireClientAuth } from "@/lib/auth";
import { getClientWorkspaceOverview, getClientVisibleFiles, listProjectMessages, getClientProjectPortalDetail } from "@/lib/queries/projects";
import { ClientWorkspaceShell } from "@/components/client-workspace-shell";
import { PortalComments } from "@/components/portal-comments";
import { PortalFiles } from "@/components/portal-files";
import { ClientSettingsTab } from "@/components/client-settings-tab";
import { markClientActionDoneAction } from "@/lib/actions";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientWorkspacePage() {
  let clientId: string;
  try {
    ({ clientId } = await requireClientAuth());
  } catch {
    redirect("/client-login");
  }

  const overview = await getClientWorkspaceOverview(clientId);
  if (!overview) redirect("/client-login");
  const { client, projectSummaries } = overview;

  const [projectFiles, projectThreads, projectDetails] = await Promise.all([
    Promise.all(projectSummaries.map((s) => getClientVisibleFiles(s.project.id))),
    Promise.all(
      projectSummaries.map(async (s) => ({
        id: s.project.id,
        name: s.project.name,
        messages: await listProjectMessages(s.project.id, s.project.organizationId!),
      }))
    ),
    Promise.all(projectSummaries.map((s) => getClientProjectPortalDetail(clientId, s.project.id))),
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

      <PortalComments projects={projectThreads} />
    </div>
  );

  const projectsContent = (
    <div className="space-y-4">
      {projectDetails.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        projectDetails.filter((d): d is NonNullable<typeof d> => d !== null).map((detail) => {
          const circumference = 2 * Math.PI * 27;
          const totalDone = detail.stages.reduce((sum, s) => sum + s.done, 0);
          const totalTasks = detail.stages.reduce((sum, s) => sum + s.total, 0);
          const percent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
          const currentStage = detail.stages.find((s) => s.isCurrent) ?? null;

          return (
            <div key={detail.project.id} className="space-y-4">
              <h2 className="text-lg font-bold">{detail.project.name}</h2>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold">Project status</h3>
                <div className="flex items-start gap-0 overflow-x-auto pb-1">
                  {detail.stages.map((s, i) => (
                    <div key={s.name} className="relative flex min-w-[84px] flex-1 flex-col items-center">
                      {i > 0 && (
                        <span
                          className="absolute left-[-50%] top-[15px] h-0.5 w-full"
                          style={{ backgroundColor: s.isDone || s.isCurrent ? "#0ca30c" : "rgba(0,0,0,.1)" }}
                        />
                      )}
                      <span
                        className="relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 text-xs font-bold"
                        style={
                          s.isDone
                            ? { backgroundColor: "#0ca30c", borderColor: "#0ca30c", color: "#fff" }
                            : s.isCurrent
                              ? { backgroundColor: "#2a78d6", borderColor: "#2a78d6", color: "#fff" }
                              : { backgroundColor: "var(--card)", borderColor: "rgba(0,0,0,.15)", color: "var(--muted-foreground)" }
                        }
                      >
                        {s.isDone ? "✓" : i + 1}
                      </span>
                      <span className={`mt-1.5 text-center text-[11px] font-semibold ${s.isDone || s.isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold">Overall progress</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg viewBox="0 0 64 64" width="64" height="64" className="-rotate-90">
                        <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="7" />
                        <circle
                          cx="32" cy="32" r="27" fill="none" stroke="#2a78d6" strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{percent}%</span>
                    </div>
                    <div className="min-w-0">
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                      {detail.project.targetLaunchDate && (
                        <p className="mt-2 text-xs text-muted-foreground">Estimated completion: {formatDate(detail.project.targetLaunchDate)}</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold">Current stage</h3>
                  {currentStage ? (
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2fb] text-sm font-bold text-primary">
                        {detail.stages.indexOf(currentStage) + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold">{currentStage.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {currentStage.total - currentStage.done} of {currentStage.total} tasks remaining in this stage
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Every stage is complete 🎉</p>
                  )}
                </section>
              </div>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold">Important dates</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between"><span className="text-[#52514e]">Project started</span><span className="font-semibold">{formatDate(detail.project.createdAt)}</span></li>
                  {detail.project.targetLaunchDate && (
                    <li className="flex justify-between"><span className="text-[#52514e]">Target launch</span><span className="font-semibold">{formatDate(detail.project.targetLaunchDate)}</span></li>
                  )}
                </ul>
              </section>
            </div>
          );
        })
      )}
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
            <PortalFiles projectId={s.project.id} initialFiles={projectFiles[i]} mode="full" />
          </div>
        ))
      )}
    </div>
  );

  const settingsContent = <ClientSettingsTab loginSlug={client.loginSlug} client={client} />;

  return (
    <ClientWorkspaceShell
      tabs={[
        { label: "Overview", slug: "overview", content: overviewContent },
        { label: "Projects", slug: "projects", badge: projectSummaries.length || undefined, content: projectsContent },
        { label: "Files", slug: "files", badge: totalFiles || undefined, content: filesContent },
        { label: "Settings", slug: "settings", content: settingsContent },
      ]}
    />
  );
}
