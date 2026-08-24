import Link from "next/link";
import { listAllTasks } from "@/lib/queries/projects";
import { requireAuth } from "@/lib/auth";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function TodayPage() {
  const { organizationId } = await requireAuth();
  const allTasks = await listAllTasks(organizationId);
  const notDone = allTasks.filter((t) => !t.parentTaskId && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED");

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const overdue = notDone
    .filter((t) => t.dueDate && new Date(t.dueDate) < todayStart)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const dueToday = notDone.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd
  );

  const criticalNoDate = notDone.filter((t) => !t.dueDate && t.isCritical && t.effectiveStatus !== "BLOCKED");

  function TaskRow({ t, dueLabel }: { t: (typeof notDone)[number]; dueLabel?: string }) {
    return (
      <Link
        href={`/projects/${t.projectId}`}
        className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            {t.title}
            {t.isCritical && (
              <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-xs font-bold text-[#d03b3b]">
                CRITICAL
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.projectName} · {t.clientName} · {t.stageName}
          </div>
        </div>
        {dueLabel && <span className="shrink-0 text-xs font-semibold text-[#d03b3b]">{dueLabel}</span>}
      </Link>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Today</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        {overdue.length} overdue · {dueToday.length} due today
      </p>

      {overdue.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[#d03b3b]">Overdue</h2>
          <div className="divide-y divide-border rounded-xl border border-[#f3c9c9] bg-[#fdf5f5]">
            {overdue.map((t) => (
              <TaskRow key={t.id} t={t} dueLabel={new Date(t.dueDate!).toLocaleDateString()} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Due today</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {dueToday.length === 0 && <div className="p-5 text-sm text-muted-foreground">Nothing due today.</div>}
          {dueToday.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </div>
      </div>

      {criticalNoDate.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[#52514e]">Critical, no due date</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Undated critical tasks are easy to lose track of — worth assigning a date.
          </p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {criticalNoDate.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
