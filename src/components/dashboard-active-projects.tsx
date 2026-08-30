import Link from "next/link";
import { FolderIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { SquarePlatformIcon } from "@/components/platform-icon";
import { progressColor } from "@/lib/project-display";

type ActiveProjectRow = {
  id: string;
  name: string;
  clientName: string;
  projectType: string;
  primaryTech: string | null;
  tasksDone: number;
  tasksTotal: number;
};

export function DashboardActiveProjects({
  projects,
  previewLimit = 20,
  featuredProjectId = null,
}: {
  projects: ActiveProjectRow[];
  previewLimit?: number;
  featuredProjectId?: string | null;
}) {
  const shown = projects.slice(0, previewLimit);

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef2fb] text-[#2a4d8f]">
            <FolderIcon className="size-5" />
          </span>
          <CardTitle>Active Projects</CardTitle>
        </div>
        <CardAction>
          <Link
            href="/projects"
            className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active projects yet.{" "}
            <Link href="/projects/new" className="text-link hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
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
      </CardContent>
    </Card>
  );
}
