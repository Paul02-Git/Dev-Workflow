import Link from "next/link";
import { FolderIcon } from "lucide-react";
import { SquarePlatformIcon } from "@/components/platform-icon";

type ActiveProjectRow = {
  id: string;
  name: string;
  clientName: string;
  projectType: string;
  primaryTech: string | null;
  tasksDone: number;
  tasksTotal: number;
};

// Same "on track / caution / behind" bands used elsewhere in the app for
// completion percentage, just green/blue/red instead of green/blue/orange.
function progressColor(percent: number): string {
  if (percent >= 85) return "#0ca30c";
  if (percent >= 60) return "#2a78d6";
  return "#d03b3b";
}

export function DashboardActiveProjects({
  projects,
  previewLimit = 6,
  featuredProjectId = null,
}: {
  projects: ActiveProjectRow[];
  previewLimit?: number;
  featuredProjectId?: string | null;
}) {
  const shown = projects.slice(0, previewLimit);

  return (
    <div className="app-card flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef2fb] text-[#2a4d8f]">
            <FolderIcon className="size-5" />
          </span>
          <h2 className="text-base font-semibold">Active Projects</h2>
        </div>
        <Link
          href="/projects"
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
        >
          View all
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active projects yet.{" "}
          <Link href="/projects/new" className="text-primary hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {shown.map((p) => {
            const percent = p.tasksTotal > 0 ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
            const color = progressColor(percent);
            const isFeatured = p.id === featuredProjectId;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`block rounded-lg border p-3 ${
                  isFeatured ? "border-[#2a78d6] bg-[#eef2fb]" : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  {p.primaryTech ? (
                    <SquarePlatformIcon name={p.primaryTech} size={30} />
                  ) : (
                    <span className="h-[30px] w-[30px] shrink-0 rounded-[4px] bg-black/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.projectType}</div>
                  </div>
                  <span className="shrink-0 text-sm font-bold" style={{ color }}>
                    {percent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
