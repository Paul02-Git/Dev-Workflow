import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProjectPortalDetail } from "@/lib/queries/projects";
import { ProjectTabs } from "@/components/project-tabs";
import { PortalComments } from "@/components/portal-comments";
import { PortalFiles } from "@/components/portal-files";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientProjectPortalPage({
  params,
}: {
  params: Promise<{ token: string; projectId: string }>;
}) {
  const { token, projectId } = await params;
  const detail = await getClientProjectPortalDetail(token, projectId);
  if (!detail) notFound();

  const { project, stages, clientFiles, messages } = detail;
  const totalDone = stages.reduce((sum, s) => sum + s.done, 0);
  const totalTasks = stages.reduce((sum, s) => sum + s.total, 0);
  const percent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const currentStage = stages.find((s) => s.isCurrent) ?? null;
  const circumference = 2 * Math.PI * 27;

  const overviewContent = (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold">Project status</h2>
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {stages.map((s, i) => (
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
          <h2 className="mb-3 text-sm font-bold">Overall progress</h2>
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
              {project.targetLaunchDate && (
                <p className="mt-2 text-xs text-muted-foreground">Estimated completion: {formatDate(project.targetLaunchDate)}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold">Current stage</h2>
          {currentStage ? (
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2fb] text-sm font-bold text-primary">
                {stages.indexOf(currentStage) + 1}
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
        <h2 className="mb-3 text-sm font-bold">Important dates</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span className="text-[#52514e]">Project started</span><span className="font-semibold">{formatDate(project.createdAt)}</span></li>
          {project.targetLaunchDate && (
            <li className="flex justify-between"><span className="text-[#52514e]">Target launch</span><span className="font-semibold">{formatDate(project.targetLaunchDate)}</span></li>
          )}
        </ul>
      </section>

      <PortalFiles token={token} projectId={projectId} initialFiles={clientFiles} mode="preview" />
    </div>
  );

  const filesContent = <PortalFiles token={token} projectId={projectId} initialFiles={clientFiles} mode="full" />;

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link href={`/portal/${token}`} className="mb-3 inline-block text-xs font-bold text-muted-foreground hover:text-primary">
          ← Your projects
        </Link>
        <h1 className="mb-5 text-xl font-bold">{project.name}</h1>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          <div>
            <ProjectTabs
              tabs={[
                { label: "Overview", slug: "overview", content: overviewContent },
                { label: "Files", slug: "files", badge: clientFiles.length || undefined, content: filesContent },
              ]}
            />
          </div>
          <PortalComments token={token} projects={[{ id: project.id, name: project.name, messages }]} />
        </div>
      </div>
    </div>
  );
}
