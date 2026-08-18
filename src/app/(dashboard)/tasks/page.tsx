import Link from "next/link";
import { listAllTasks } from "@/lib/queries/projects";
import { TaskBulkList } from "@/components/task-bulk-list";

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

  const statusCounts = topLevel.reduce<Record<string, number>>((acc, t) => {
    acc[t.effectiveStatus] = (acc[t.effectiveStatus] ?? 0) + 1;
    return acc;
  }, {});

  const byProject = new Map<string, typeof filtered>();
  for (const t of filtered) {
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
            !status ? "bg-primary text-primary-foreground" : "bg-black/5 text-[#52514e] hover:bg-black/10"
          }`}
        >
          All ({topLevel.length})
        </Link>
        {Object.entries(statusCounts).map(([s, count]) => (
          <Link
            key={s}
            href={`/tasks?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s ? "bg-primary text-primary-foreground" : "bg-black/5 text-[#52514e] hover:bg-black/10"
            }`}
          >
            {s.replace("_", " ")} ({count})
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No tasks match this filter.
        </div>
      )}

      <TaskBulkList
        projectGroups={Array.from(byProject.entries()).map(([projectId, projectTasks]) => ({
          projectId,
          projectName: projectTasks[0].projectName,
          clientName: projectTasks[0].clientName,
          tasks: projectTasks,
        }))}
      />
    </div>
  );
}
