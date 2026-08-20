import { TaskStatusSelect } from "@/components/task-status-select";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TaskDetailsToggle } from "@/components/task-details";
import { TaskWaitingToggle } from "@/components/task-waiting-toggle";

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  effectiveStatus: string;
  isCritical: boolean;
  dueDate: Date | string | null;
  assignee: string | null;
  notes: string | null;
  isWaitingOnClient: boolean;
  tags: { id: string; name: string }[];
  attachments: { id: string; url: string | null; label: string | null }[];
};

/**
 * Renders one board (task list grouped by stage) — shared by the Tasks tab
 * (build stages) and the QA tab (QA stage only) so the two views stay in
 * sync without duplicating this markup.
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
  return (
    <div className="space-y-6">
      {stages.map((stage) => {
        const stageTasks = tasksByStage.get(stage.id) ?? [];
        if (stageTasks.length === 0) return null;
        return (
          <div key={stage.id}>
            <h2 className="mb-2 text-sm font-semibold text-[#52514e]">{stage.name}</h2>
            <div className="app-card divide-y divide-border">
              {stageTasks.map((task) => (
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
                          {task.isCritical && (
                            <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                              CRITICAL
                            </span>
                          )}
                          {task.status === "DONE" && task.attachments.length > 0 && (
                            <span
                              className="rounded-full bg-[#eafaea] px-1.5 py-0.5 text-[10px] font-bold text-[#0ca30c]"
                              title={`${task.attachments.length} attachment(s) as proof`}
                            >
                              ✓ VERIFIED
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground">{task.description}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {task.dueDate && (
                            <span
                              className={`text-[10px] font-medium ${
                                new Date(task.dueDate) < new Date() && task.effectiveStatus !== "DONE"
                                  ? "text-[#d03b3b]"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignee && (
                            <span className="text-[10px] font-medium text-muted-foreground">{task.assignee}</span>
                          )}
                          {task.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full bg-[#eef2fb] px-1.5 py-0.5 text-[10px] font-medium text-[#2a4d8f]"
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
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
