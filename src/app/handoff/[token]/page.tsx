import { notFound } from "next/navigation";
import { getProjectByHandoffToken } from "@/lib/queries/projects";
import { CLIENT_ACTION_CANONICAL_KEYS } from "@/data/client-action-keys";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "In Progress", color: "#c9720a" },
  ON_HOLD: { label: "On Hold", color: "#898781" },
  LAUNCHED: { label: "Live", color: "#0ca30c" },
  ARCHIVED: { label: "Archived", color: "#898781" },
};

const ACCESS_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  NOT_REQUESTED: { label: "Not requested", color: "#898781" },
  REQUESTED: { label: "Requested", color: "#c9720a" },
  INVITED: { label: "Invited", color: "#c9720a" },
  GRANTED: { label: "Access granted", color: "#0ca30c" },
  VERIFIED: { label: "Access verified", color: "#0ca30c" },
};

export default async function HandoffPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getProjectByHandoffToken(token);
  if (!data) notFound();

  const { project, clientName, technologies, criticalTasks, completedTasks, accessItems, clientActionTasks } = data;
  const status = STATUS_LABEL[project.status] ?? { label: project.status, color: "#898781" };

  // The dev/QA checklist excludes client-owned items — they get their own
  // section below instead, so "what's unchecked here" always means "our job."
  const devChecklist = criticalTasks.filter((t) => !CLIENT_ACTION_CANONICAL_KEYS.has(t.canonicalKey ?? ""));
  const doneCount = devChecklist.filter((t) => t.status === "DONE").length;
  const pendingClientActions = clientActionTasks.filter((t) => t.status !== "DONE");

  const completedByStage = new Map<string, { stageName: string; sortOrder: number; titles: string[] }>();
  for (const t of completedTasks) {
    if (!completedByStage.has(t.stageName)) {
      completedByStage.set(t.stageName, { stageName: t.stageName, sortOrder: t.stageSortOrder, titles: [] });
    }
    completedByStage.get(t.stageName)!.titles.push(t.title);
  }
  const completedStages = Array.from(completedByStage.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-[#52514e]">Prepared for {clientName}</p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: status.color }}
          >
            {status.label}
          </span>
        </div>

        {project.domain && (
          <a
            href={`https://${project.domain.replace(/^https?:\/\//, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            {project.domain} ↗
          </a>
        )}

        {pendingClientActions.length > 0 && (
          <div className="mb-6 rounded-xl border-2 border-[#c9720a] bg-[#fef4de] p-5">
            <h2 className="mb-2 text-sm font-semibold text-[#8a5c00]">
              What we need from you ({pendingClientActions.length})
            </h2>
            <ul className="space-y-1.5">
              {pendingClientActions.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="text-[#8a5c00]">☐</span>
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {technologies.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">What we built with</h2>
            <div className="flex flex-wrap gap-1.5">
              {technologies.map((name) => (
                <span key={name} className="rounded-full bg-[#eef2fb] px-2.5 py-1 text-xs font-medium text-[#2a4d8f]">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">
              Completed work — {completedTasks.length} item(s) delivered
            </h2>
            <div className="space-y-3">
              {completedStages.map((stage) => (
                <div key={stage.stageName}>
                  <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                    {stage.stageName} ({stage.titles.length})
                  </h3>
                  <ul className="space-y-1">
                    {stage.titles.map((title) => (
                      <li key={title} className="flex items-center gap-2 text-sm">
                        <span className="text-[#0ca30c]">☑</span>
                        {title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {devChecklist.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">
              Launch checklist — {doneCount}/{devChecklist.length} complete
            </h2>
            <ul className="space-y-1.5">
              {devChecklist.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 text-sm ${
                    t.status === "DONE" ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  <span className={t.status === "DONE" ? "text-[#0ca30c]" : "text-muted-foreground"}>
                    {t.status === "DONE" ? "☑" : "☐"}
                  </span>
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {accessItems.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Your accounts</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              For security, passwords aren&apos;t shown here — reach out if you need one reset or shared.
            </p>
            <ul className="divide-y divide-border">
              {accessItems.map((item) => {
                const accessStatus = ACCESS_STATUS_LABEL[item.status] ?? { label: item.status, color: "#898781" };
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.username && <span>{item.username}</span>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Open ↗
                        </a>
                      )}
                      <span className="font-semibold" style={{ color: accessStatus.color }}>
                        {accessStatus.label}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">This is a private, read-only summary link.</p>
      </div>
    </div>
  );
}
