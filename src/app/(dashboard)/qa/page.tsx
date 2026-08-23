import Link from "next/link";
import { listAllTasks } from "@/lib/queries/projects";
import { STATUS_COLORS } from "@/components/task-status-select";
import { requireAuth } from "@/lib/auth";

export default async function QaPage() {
  const { organizationId } = await requireAuth();
  const allTasks = await listAllTasks(organizationId);
  const qaTasks = allTasks.filter((t) => t.stageKey === "qa");

  const byProject = new Map<string, typeof qaTasks>();
  for (const t of qaTasks) {
    if (!byProject.has(t.projectId)) byProject.set(t.projectId, []);
    byProject.get(t.projectId)!.push(t);
  }

  const notDone = qaTasks.filter((t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED");
  const failing = qaTasks.filter((t) => t.effectiveStatus === "BLOCKED");

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">QA</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        {qaTasks.length} QA task(s) across {byProject.size} project(s) · {notDone.length} not done ·{" "}
        {failing.length} blocked
      </p>

      {Array.from(byProject.entries()).map(([projectId, projectTasks]) => {
        const first = projectTasks[0];
        const openCount = projectTasks.filter(
          (t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED"
        ).length;
        return (
          <div key={projectId} className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/projects/${projectId}`} className="text-sm font-semibold hover:underline">
                {first.projectName} <span className="font-normal text-muted-foreground">· {first.clientName}</span>
              </Link>
              <span className="text-xs text-muted-foreground">{openCount} open</span>
            </div>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {projectTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${
                    t.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {t.title}
                    {t.isCritical && (
                      <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-xs font-bold text-[#d03b3b]">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: STATUS_COLORS[t.effectiveStatus] ?? STATUS_COLORS[t.status] }}
                  >
                    {t.effectiveStatus.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {byProject.size === 0 && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No QA tasks generated yet — QA tasks appear once a project has been created.
        </div>
      )}
    </div>
  );
}
