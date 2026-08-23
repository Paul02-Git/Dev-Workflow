import Link from "next/link";
import { listTechnologyUsage } from "@/lib/queries/projects";

export default async function IntegrationsPage() {
  const usage = await listTechnologyUsage();
  const byCategory = new Map<string, typeof usage>();
  for (const t of usage) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Integrations</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        Which technologies are in use across your projects. This is informational only — there&apos;s no live
        OAuth-synced connection to any of these accounts yet; each project&apos;s tasks track setup by hand.
      </p>

      {Array.from(byCategory.entries()).map(([category, techs]) => (
        <div key={category} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[#52514e]">{category}</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {techs.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{t.name}</span>
                {t.projects.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Not used yet</span>
                ) : (
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {t.projects.map((p) => (
                      <Link
                        key={p.projectId}
                        href={`/projects/${p.projectId}`}
                        className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-[#52514e] hover:bg-black/10"
                      >
                        {p.projectName}
                      </Link>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
