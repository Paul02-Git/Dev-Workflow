import Link from "next/link";
import { listAllTasks } from "@/lib/queries/projects";
import { STATUS_COLORS } from "@/components/task-status-select";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const allTasks = await listAllTasks();

  // Top-level tasks only — subtasks clutter a cross-project list without
  // their parent's context.
  const topLevel = allTasks.filter((t) => !t.parentTaskId);
  const filtered = status ? topLevel.filter((t) => t.effectiveStatus === status) : topLevel;

  const sorted = [...filtered].sort((a, b) => {
    if (a.effectiveStatus === "DONE" && b.effectiveStatus !== "DONE") return 1;
    if (b.effectiveStatus === "DONE" && a.effectiveStatus !== "DONE") return -1;
    return 0;
  });

  const statusCounts = topLevel.reduce<Record<string, number>>((acc, t) => {
    acc[t.effectiveStatus] = (acc[t.effectiveStatus] ?? 0) + 1;
    return acc;
  }, {});

  const byProject = new Map<string, typeof sorted>();
  for (const t of sorted) {
    if (!byProject.has(t.projectId)) byProject.set(t.projectId, []);
    byProject.get(t.projectId)!.push(t);
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Tasks</h1>
      <p className="mb-6 text-sm text-[#52514e]">{topLevel.length} task(s) across all projects</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/tasks"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !status ? "bg-[#2a78d6] text-white" : "bg-black/5 text-[#52514e] hover:bg-black/10"
          }`}
        >
          All ({topLevel.length})
        </Link>
        {Object.entries(statusCounts).map(([s, count]) => (
          <Link
            key={s}
            href={`/tasks?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s ? "bg-[#2a78d6] text-white" : "bg-black/5 text-[#52514e] hover:bg-black/10"
            }`}
          >
            {s.replace("_", " ")} ({count})
          </Link>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="rounded-xl border border-black/10 bg-[#fcfcfb] p-5 text-sm text-[#898781]">
          No tasks match this filter.
        </div>
      )}

      {Array.from(byProject.entries()).map(([projectId, projectTasks]) => {
        const first = projectTasks[0];
        return (
          <div key={projectId} className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/projects/${projectId}`} className="text-sm font-semibold hover:underline">
                {first.projectName} <span className="font-normal text-[#898781]">· {first.clientName}</span>
              </Link>
              <span className="text-xs text-[#898781]">{projectTasks.length} task(s)</span>
            </div>
            <div className="divide-y divide-black/10 rounded-xl border border-black/10 bg-[#fcfcfb]">
              {projectTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}`}
                  className={`flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-[#f9f9f7] ${
                    t.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {t.title}
                      {t.isCritical && (
                        <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#898781]">
                      {t.stageName}
                      {t.assignee && ` · ${t.assignee}`}
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-xs font-semibold"
                    style={{ color: STATUS_COLORS[t.effectiveStatus] ?? STATUS_COLORS[t.status] }}
                  >
                    {t.effectiveStatus.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
