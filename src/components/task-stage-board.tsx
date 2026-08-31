import { ChevronRightIcon, RepeatIcon } from "lucide-react";
import { TaskTableRow, type BoardTask } from "@/components/task-table-row";

// Tag generateMaintenanceRun() stamps every task it creates with - plain
// "maintenance" now (one persistent task per checklist item, reused across
// cycles), or the older dated "maintenance:2026-08" form on tasks created
// before that task got reused instead of duplicated (see
// src/lib/queries/maintenance.ts) - both still need to land in this bucket.
function isMaintenanceTask(task: BoardTask): boolean {
  return task.tags.some((t) => t.name === "maintenance" || t.name.startsWith("maintenance:"));
}

const COLUMN_HEADERS = ["Task Name", "Status", "Notes", "Due", "Sub Tasks", "Priority"];

// Fixed widths for every column but Task Name (which absorbs whatever
// space is left) - table-layout: fixed means every stage's table sizes
// its columns off these, not off that table's own longest task name, so
// Status/Assign/Due/etc. line up across stage cards no matter how short
// or long the task names in each one are.
const COLUMN_WIDTHS = [undefined, 180, 180, 180, 180, 180];

function TaskTable({ tasks, subtasksByParent }: { tasks: BoardTask[]; subtasksByParent: Map<string, BoardTask[]> }) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-sm">
        <colgroup>
          {COLUMN_WIDTHS.map((w, i) => (
            <col key={i} style={w ? { width: w } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
            {COLUMN_HEADERS.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskTableRow key={task.id} task={task} subtasks={subtasksByParent.get(task.id) ?? []} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders one board (task list grouped by stage) - shared by the Tasks tab
 * (build stages), the QA tab (QA stage only), and the Launch tab (Launch/
 * Handoff/Post-Launch) so these views stay in sync without duplicating this
 * markup. Each stage is a collapsible group (open by default, so nothing
 * that used to always be visible is hidden without an explicit click) with
 * a real, computed done/total count in its header instead of an invented
 * per-stage date range.
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
  const visibleStages = stages.filter((s) => (tasksByStage.get(s.id) ?? []).length > 0);

  return (
    <div className="space-y-3">
      {visibleStages.map((stage) => {
        const stageTasks = tasksByStage.get(stage.id) ?? [];
        const regularTasks = stageTasks.filter((t) => !isMaintenanceTask(t));
        const maintenanceTasks = stageTasks.filter(isMaintenanceTask);
        const doneCount = stageTasks.filter((t) => t.effectiveStatus === "DONE").length;

        return (
          <details key={stage.id} open className="app-card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 select-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-open:rotate-90" />
                <span className="text-base font-semibold text-foreground">{stage.name}</span>
              </span>
              <span className="text-sm text-muted-foreground/70">
                {doneCount}/{stageTasks.length}
              </span>
            </summary>

            <div className="border-t border-border">
              {regularTasks.length > 0 && <TaskTable tasks={regularTasks} subtasksByParent={subtasksByParent} />}
              {maintenanceTasks.length > 0 && (
                <div className={regularTasks.length > 0 ? "border-t border-border" : undefined}>
                  <h3 className="flex items-center gap-1.5 px-4 pt-3 text-sm font-medium text-muted-foreground/70">
                    <RepeatIcon className="size-4" /> Recurring Maintenance
                  </h3>
                  <TaskTable tasks={maintenanceTasks} subtasksByParent={subtasksByParent} />
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
