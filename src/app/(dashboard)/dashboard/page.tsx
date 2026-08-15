import Link from "next/link";
import { listProjects } from "@/lib/queries/projects";
import { getProjectIssues } from "@/lib/queries/projects";

function healthColor(score: number) {
  if (score >= 85) return "#0ca30c";
  if (score >= 60) return "#fab219";
  return "#d03b3b";
}

export default async function DashboardPage() {
  const projects = await listProjects();

  const issuesByProject = await Promise.all(
    projects.map(async (p) => ({ project: p, issues: await getProjectIssues(p.id) }))
  );
  const allIssues = issuesByProject.flatMap((x) =>
    x.issues.map((issue) => ({ ...issue, projectName: x.project.name }))
  );

  const avgHealth = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length)
    : 0;
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        {activeCount} active project(s) · avg health {avgHealth}%
      </p>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-black/10 bg-[#fcfcfb] p-4">
          <div className="text-xs font-semibold text-[#52514e]">Active projects</div>
          <div className="text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#fcfcfb] p-4">
          <div className="text-xs font-semibold text-[#52514e]">Avg health</div>
          <div className="text-2xl font-bold" style={{ color: healthColor(avgHealth) }}>
            {avgHealth}%
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#fcfcfb] p-4">
          <div className="text-xs font-semibold text-[#52514e]">Potential issues</div>
          <div className="text-2xl font-bold">{allIssues.length}</div>
        </div>
      </div>

      {allIssues.length > 0 && (
        <div className="mb-8 rounded-xl border border-black/10 bg-[#fcfcfb] p-5">
          <h2 className="mb-3 text-sm font-semibold">Needs attention — potentially forgotten</h2>
          <ul className="space-y-2">
            {allIssues.map((issue) => (
              <li key={`${issue.projectName}-${issue.id}`} className="flex gap-2 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#fef4de] text-xs font-bold text-[#8a5c00]">
                  !
                </span>
                <div>
                  <div>{issue.message}</div>
                  <div className="text-[11px] text-[#898781]">
                    {issue.projectName} · {issue.area}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold">Active projects</h2>
      <div className="divide-y divide-black/10 rounded-xl border border-black/10 bg-[#fcfcfb]">
        {projects.length === 0 && (
          <div className="p-5 text-sm text-[#898781]">
            No projects yet. <Link href="/projects/new" className="text-[#2a78d6]">Create one</Link>.
          </div>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#f9f9f7]"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[#898781]">
                {p.clientName} · {p.projectType}
              </div>
            </div>
            <span className="text-xs font-semibold" style={{ color: healthColor(p.healthScore) }}>
              {p.healthScore}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
