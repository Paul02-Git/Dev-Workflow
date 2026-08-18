import { ALL_TEMPLATES } from "@/data/templates";
import { STAGES } from "@/data/stages";

const stageNameByKey = new Map<string, string>(STAGES.map((s) => [s.key, s.name]));

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#c9720a",
  MEDIUM: "#898781",
  LOW: "#b3b1ab",
};

export default function TemplatesPage() {
  const alwaysInclude = ALL_TEMPLATES.filter((t) => t.alwaysInclude);
  const perTechnology = ALL_TEMPLATES.filter((t) => !t.alwaysInclude);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold">Workflow Templates</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        Read-only view of the {ALL_TEMPLATES.length} templates the workflow engine draws from. Edit these in{" "}
        <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">src/data/templates/*.ts</code>.
      </p>

      <h2 className="mb-2 text-sm font-semibold text-[#52514e]">Always included</h2>
      <div className="mb-8 space-y-4">
        {alwaysInclude.map((template) => (
          <TemplateCard key={template.key} template={template} />
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-[#52514e]">Per technology</h2>
      <div className="space-y-4">
        {perTechnology.map((template) => (
          <TemplateCard key={template.key} template={template} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: (typeof ALL_TEMPLATES)[number] }) {
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
        {template.name}
        <span className="ml-2 font-normal text-muted-foreground">{template.tasks.length} task(s)</span>
      </summary>
      <div className="divide-y divide-black/5 border-t border-border">
        {template.tasks.map((task) => (
          <div key={task.canonicalKey} className="px-5 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{task.title}</span>
              {task.isCritical && (
                <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                  CRITICAL
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{stageNameByKey.get(task.stage) ?? task.stage}</span>
              <span style={{ color: PRIORITY_COLORS[task.priority ?? "MEDIUM"] }}>
                {task.priority ?? "MEDIUM"}
              </span>
              {task.dependsOn && task.dependsOn.length > 0 && (
                <span>depends on: {task.dependsOn.join(", ")}</span>
              )}
            </div>
            {task.description && <div className="mt-0.5 text-xs text-[#52514e]">{task.description}</div>}
            {task.subtasks && task.subtasks.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {task.subtasks.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
