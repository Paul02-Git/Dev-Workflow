import { ChevronDownIcon } from "lucide-react";

type TimelineStage = {
  id: string;
  name: string;
  status: "done" | "current" | "pending";
};

const STATUS_LABEL: Record<TimelineStage["status"], string> = {
  done: "Complete",
  current: "In progress",
  pending: "Pending",
};

const STATUS_TEXT_COLOR: Record<TimelineStage["status"], string> = {
  done: "text-[#0ca30c]",
  current: "text-primary",
  pending: "text-muted-foreground",
};

const STATUS_DOT_COLOR: Record<TimelineStage["status"], string> = {
  done: "bg-[#0ca30c]",
  current: "bg-primary",
  pending: "bg-black/15",
};

export function ProjectTimeline({ stages }: { stages: TimelineStage[] }) {
  if (stages.length === 0) return null;

  const doneCount = stages.filter((s) => s.status === "done").length;
  const currentStage = stages.find((s) => s.status === "current");

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Timeline / Milestones</h2>

      {/* At-a-glance summary — answers "where is this project right now?" in
          one line, without needing to scan every stage. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {currentStage ? currentStage.name : "All stages complete"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {doneCount} of {stages.length} stages complete
        </span>
      </div>
      <div className={`mb-2 text-xs font-medium ${currentStage ? "text-primary" : "text-[#0ca30c]"}`}>
        {currentStage ? "In progress" : "Complete"}
      </div>

      {/* A single-row progress bar scales to any number of stages without
          ever needing horizontal scrolling — each segment is hoverable for
          its name/status, and the full breakdown is one click away below. */}
      <div className="flex gap-1">
        {stages.map((stage) => (
          <span
            key={stage.id}
            title={`${stage.name} — ${STATUS_LABEL[stage.status]}`}
            className={`h-1.5 flex-1 rounded-full ${STATUS_DOT_COLOR[stage.status]}`}
          />
        ))}
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
          View all stages
          <ChevronDownIcon className="size-3 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 divide-y divide-black/5">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLOR[stage.status]}`} />
                <span className={`truncate text-sm ${stage.status === "pending" ? "text-[#a6a4ab]" : "text-foreground"}`}>
                  {stage.name}
                </span>
              </span>
              <span className={`shrink-0 text-xs ${STATUS_TEXT_COLOR[stage.status]}`}>{STATUS_LABEL[stage.status]}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
