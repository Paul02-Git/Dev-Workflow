import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/queries/projects";
import { TaskStatusSelect } from "@/components/task-status-select";
import { CheckProjectButton } from "@/components/check-project-button";
import { TaskDetailsToggle } from "@/components/task-details";
import { DeleteButton } from "@/components/delete-button";
import { deleteProjectAction } from "@/lib/actions";

function healthColor(score: number) {
  if (score >= 85) return "#0ca30c";
  if (score >= 60) return "#fab219";
  return "#d03b3b";
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  const { project, client, stages, tasks } = detail;
  const tasksByStage = new Map<string, typeof tasks>();
  for (const stage of stages) tasksByStage.set(stage.id, []);
  for (const task of tasks) {
    if (task.parentTaskId) continue; // subtasks render nested under their parent
    tasksByStage.get(task.stageId)?.push(task);
  }
  const subtasksByParent = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    if (!subtasksByParent.has(task.parentTaskId)) subtasksByParent.set(task.parentTaskId, []);
    subtasksByParent.get(task.parentTaskId)!.push(task);
  }

  const criticalTasks = tasks.filter((t) => t.isCritical);
  const criticalDone = criticalTasks.filter((t) => t.effectiveStatus === "DONE").length;
  const launchReady = criticalTasks.length > 0 && criticalDone === criticalTasks.length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/projects" className="text-xs font-medium text-[#2a78d6]">
          ← All projects
        </Link>
        <DeleteButton action={deleteProjectAction.bind(null, project.id)} label="Delete project" />
      </div>

      <div className="mt-2 mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-sm text-[#52514e]">
            {client?.name} · {project.projectType}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: healthColor(detail.healthScore) }}>
            {detail.healthScore}%
          </div>
          <div className="text-[11px] font-semibold text-[#898781]">Project health</div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border border-black/10 bg-[#fcfcfb] p-4">
        <div className="text-sm">
          <span className="font-semibold">Launch readiness: </span>
          {criticalTasks.length === 0 ? (
            <span className="text-[#898781]">no critical tasks yet</span>
          ) : (
            <span>
              {criticalDone}/{criticalTasks.length} critical tasks done —{" "}
              {launchReady ? (
                <span className="font-semibold text-[#006300]">Ready for Launch</span>
              ) : (
                <span className="font-semibold text-[#d03b3b]">Not ready</span>
              )}
            </span>
          )}
        </div>
        <CheckProjectButton projectId={project.id} />
      </div>

      <div className="space-y-6">
        {stages.map((stage) => {
          const stageTasks = tasksByStage.get(stage.id) ?? [];
          if (stageTasks.length === 0) return null;
          return (
            <div key={stage.id}>
              <h2 className="mb-2 text-sm font-semibold text-[#52514e]">{stage.name}</h2>
              <div className="divide-y divide-black/10 rounded-lg border border-black/10 bg-[#fcfcfb]">
                {stageTasks.map((task) => (
                  <div key={task.id}>
                    <div
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        task.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {task.title}
                          {task.isCritical && (
                            <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-xs text-[#898781]">{task.description}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {task.dueDate && (
                            <span
                              className={`text-[10px] font-medium ${
                                new Date(task.dueDate) < new Date() && task.effectiveStatus !== "DONE"
                                  ? "text-[#d03b3b]"
                                  : "text-[#898781]"
                              }`}
                            >
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignee && (
                            <span className="text-[10px] font-medium text-[#898781]">{task.assignee}</span>
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
                            assignee={task.assignee}
                            tags={task.tags}
                            attachments={task.attachments}
                          />
                        </div>
                      </div>
                      <TaskStatusSelect
                        taskId={task.id}
                        status={task.status}
                        effectiveStatus={task.effectiveStatus}
                      />
                    </div>
                    {(subtasksByParent.get(task.id) ?? []).length > 0 && (
                      <div className="space-y-1 border-t border-black/5 bg-[#f9f9f7] px-4 py-2 pl-8">
                        {subtasksByParent.get(task.id)!.map((sub) => (
                          <div
                            key={sub.id}
                            className={`flex items-center justify-between gap-3 rounded px-1 ${
                              sub.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                            }`}
                          >
                            <span className="text-xs text-[#52514e]">— {sub.title}</span>
                            <TaskStatusSelect
                              taskId={sub.id}
                              status={sub.status}
                              effectiveStatus={sub.effectiveStatus}
                            />
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
    </div>
  );
}
