import Link from "next/link";

type ActionTask = {
  id: string;
  title: string;
  isCritical: boolean;
  priority: string;
  stageName: string;
};

export function NextActionsCard({ projectId, tasks }: { projectId: string; tasks: ActionTask[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Next actions</h2>
        <Link
          href={`/projects/${projectId}?tab=tasks`}
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
        >
          View tasks
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing actionable right now — everything is either done or blocked.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  {t.title}
                  {t.isCritical && (
                    <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                      CRITICAL
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">{t.stageName}</div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{t.priority}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
