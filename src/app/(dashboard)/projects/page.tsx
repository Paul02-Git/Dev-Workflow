import Link from "next/link";
import { listProjects } from "@/lib/queries/projects";

function healthColor(score: number) {
  if (score >= 85) return "#0ca30c";
  if (score >= 60) return "#fab219";
  return "#d03b3b";
}

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-[#52514e]">{projects.length} project(s)</p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          + New project
        </Link>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {projects.length === 0 && (
          <div className="p-5 text-sm text-muted-foreground">
            No projects yet. <Link href="/projects/new" className="text-primary">Create one</Link>.
          </div>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.clientName} · {p.projectType}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: healthColor(p.healthScore) }}>
                {p.healthScore}%
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[#52514e]">
                {p.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
