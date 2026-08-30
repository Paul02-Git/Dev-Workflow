import Link from "next/link";

type ActionTask = {
  id: string;
  title: string;
  isCritical: boolean;
  priority: string;
  stageName: string;
};

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#c9720a",
  MEDIUM: "#52514e",
  LOW: "#898781",
};
const PRIORITY_BG: Record<string, string> = {
  CRITICAL: "#fbe6e6",
  HIGH: "#fef4de",
  MEDIUM: "#f1f0ee",
  LOW: "#f1f0ee",
};

export function NextActionsCard({
  projectId,
  tasks,
  viewAllTabSlug = "tasks",
}: {
  projectId: string;
  tasks: ActionTask[];
  viewAllTabSlug?: "tasks" | "qa" | "launch";
}) {
  return (
    <div className="app-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Next actions</h2>
        <Link
          href={`/projects/${projectId}?tab=${viewAllTabSlug}&filter=actionable`}
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-link hover:bg-muted"
        >
          View tasks
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing actionable right now — everything is either done or blocked.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => {
            const label = t.isCritical ? "CRITICAL" : t.priority;
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.stageName}</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: PRIORITY_BG[label] ?? "#f1f0ee", color: PRIORITY_COLOR[label] ?? "#898781" }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
