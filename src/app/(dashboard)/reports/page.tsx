import { listProjects, listAllTasks } from "@/lib/queries/projects";

function healthColor(score: number) {
  if (score >= 85) return "#0ca30c";
  if (score >= 60) return "#fab219";
  return "#d03b3b";
}

export default async function ReportsPage() {
  const [projects, allTasks] = await Promise.all([listProjects(), listAllTasks()]);
  const topLevel = allTasks.filter((t) => !t.parentTaskId);

  const statusCounts = topLevel.reduce<Record<string, number>>((acc, t) => {
    acc[t.effectiveStatus] = (acc[t.effectiveStatus] ?? 0) + 1;
    return acc;
  }, {});

  const priorityCounts = topLevel.reduce<Record<string, number>>((acc, t) => {
    acc[t.priority] = (acc[t.priority] ?? 0) + 1;
    return acc;
  }, {});

  const criticalOpen = topLevel.filter((t) => t.isCritical && t.effectiveStatus !== "DONE").length;
  const blocked = topLevel.filter((t) => t.effectiveStatus === "BLOCKED").length;
  const overdue = topLevel.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.effectiveStatus !== "DONE"
  ).length;

  const avgHealth = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length)
    : 0;

  const byClient = new Map<string, { count: number; avgHealth: number }>();
  for (const p of projects) {
    const existing = byClient.get(p.clientName) ?? { count: 0, avgHealth: 0 };
    existing.avgHealth = (existing.avgHealth * existing.count + p.healthScore) / (existing.count + 1);
    existing.count += 1;
    byClient.set(p.clientName, existing);
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Reports</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        {projects.length} project(s) · {topLevel.length} task(s) · avg health {avgHealth}%
      </p>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Avg health</div>
          <div className="text-2xl font-bold" style={{ color: healthColor(avgHealth) }}>
            {avgHealth}%
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Critical, open</div>
          <div className="text-2xl font-bold text-[#d03b3b]">{criticalOpen}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Blocked</div>
          <div className="text-2xl font-bold text-[#eda100]">{blocked}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Overdue</div>
          <div className="text-2xl font-bold text-[#d03b3b]">{overdue}</div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Tasks by status</h2>
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-[#52514e]">{status.replace("_", " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Tasks by priority</h2>
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            {Object.entries(priorityCounts).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between text-sm">
                <span className="text-[#52514e]">{priority}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Health by client</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from(byClient.entries()).map(([clientName, stat]) => (
          <div key={clientName} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>
              {clientName} <span className="text-muted-foreground">· {stat.count} project(s)</span>
            </span>
            <span className="font-semibold" style={{ color: healthColor(Math.round(stat.avgHealth)) }}>
              {Math.round(stat.avgHealth)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
