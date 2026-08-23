import { RepeatIcon } from "lucide-react";
import { TaskStatusSelect } from "@/components/task-status-select";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TaskDetailsToggle } from "@/components/task-details";
import { TaskWaitingToggle } from "@/components/task-waiting-toggle";

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

// Tag generateMaintenanceRun() stamps every task it creates with — plain
// "maintenance" now (one persistent task per checklist item, reused across
// cycles), or the older dated "maintenance:2026-08" form on tasks created
// before that task got reused instead of duplicated (see
// src/lib/queries/maintenance.ts) — both still need to land in this bucket.

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  effectiveStatus: string;
  isCritical: boolean;
  priority: string;
  dueDate: Date | string | null;
  assignee: string | null;
  notes: string | null;
  isWaitingOnClient: boolean;
  tags: { id: string; name: string }[];
  attachments: { id: string; url: string | null; storagePath: string | null; label: string | null }[];
};

function isMaintenanceTask(task: BoardTask): boolean {
  return task.tags.some((t) => t.name === "maintenance" || t.name.startsWith("maintenance:"));
}

/**
 * Renders one board (task list grouped by stage) — shared by the Tasks tab
 * (build stages), the QA tab (QA stage only), and the Launch tab (Launch/
 * Handoff/Post-Launch) so these views stay in sync without duplicating this
 * markup.
 */
export function TaskStageBoard({
  stages,
  tasksByStage,
  subtasksByParent,
}: {
  stages: { id: string; name: string }[];
  tasksByStage: Map<string, BoardTask[]>;
  subtasksByParent: Map<string, BoardTask[]>;
}) {
  function renderTaskRow(task: BoardTask) {
    return (
      <div key={task.id}>
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 ${
            task.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="pt-0.5">
              <TaskDoneCheckbox taskId={task.id} status={task.status} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {task.title}
                {(() => {
                  const priorityLabel = task.isCritical ? "CRITICAL" : task.priority;
                  return (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: PRIORITY_BG[priorityLabel] ?? "#f1f0ee",
                        color: PRIORITY_COLOR[priorityLabel] ?? "#898781",
                      }}
                    >
                      {priorityLabel}
                    </span>
                  );
                })()}
                {task.status === "DONE" && task.attachments.length > 0 && (
                  <span
                    className="rounded-full bg-[#eafaea] px-1.5 py-0.5 text-xs font-bold text-[#0ca30c]"
                    title={`${task.attachments.length} attachment(s) as proof`}
                  >
                    ✓ VERIFIED
                  </span>
                )}
              </div>
              {task.description && <div className="text-xs text-muted-foreground">{task.description}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {task.dueDate && (
                  <span
                    className={`text-xs font-medium ${
                      new Date(task.dueDate) < new Date() && task.effectiveStatus !== "DONE"
                        ? "text-[#d03b3b]"
                        : "text-muted-foreground"
                    }`}
                  >
                    Due {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                {task.assignee && <span className="text-xs font-medium text-muted-foreground">{task.assignee}</span>}
                {task.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-[#eef2fb] px-1.5 py-0.5 text-xs font-medium text-[#2a4d8f]"
                  >
                    {tag.name}
                  </span>
                ))}
                <TaskDetailsToggle
                  taskId={task.id}
                  notes={task.notes}
                  dueDate={task.dueDate}
                  attachments={task.attachments}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TaskWaitingToggle taskId={task.id} isWaitingOnClient={task.isWaitingOnClient} />
            <TaskStatusSelect taskId={task.id} status={task.status} effectiveStatus={task.effectiveStatus} />
          </div>
        </div>
        {(subtasksByParent.get(task.id) ?? []).length > 0 && (
          <div className="space-y-3 border-t border-black/5 bg-[#f9f9f9] px-4 py-2 pl-8">
            {subtasksByParent.get(task.id)!.map((sub) => (
              <div
                key={sub.id}
                className={`flex items-center justify-between gap-4 rounded px-1 ${
                  sub.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2 text-xs text-[#52514e]">
                  <TaskDoneCheckbox taskId={sub.id} status={sub.status} />— {sub.title}
                </span>
                <TaskStatusSelect taskId={sub.id} status={sub.status} effectiveStatus={sub.effectiveStatus} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stages.map((stage) => {
        const stageTasks = tasksByStage.get(stage.id) ?? [];
        if (stageTasks.length === 0) return null;

        // Recurring maintenance-cycle tasks land in the same stage as the
        // project's own one-time workflow tasks (see MAINTENANCE_STAGE_KEY
        // in src/lib/queries/maintenance.ts) — split them into their own
        // block so a scan of "what's left to build/launch" isn't diluted by
        // "what a past maintenance cycle generated."
        const regularTasks = stageTasks.filter((t) => !isMaintenanceTask(t));
        const maintenanceTasks = stageTasks.filter(isMaintenanceTask);

        return (
          <div key={stage.id}>
            <h2 className="mb-2 text-sm font-semibold text-[#52514e]">{stage.name}</h2>
            {regularTasks.length > 0 && (
              <div className="app-card divide-y divide-border">{regularTasks.map(renderTaskRow)}</div>
            )}
            {maintenanceTasks.length > 0 && (
              <div className={regularTasks.length > 0 ? "mt-6" : undefined}>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#52514e]">
                  <RepeatIcon className="size-3.5" /> Recurring Maintenance
                </h3>
                <div className="app-card divide-y divide-border bg-muted/30">
                  {maintenanceTasks.map(renderTaskRow)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
