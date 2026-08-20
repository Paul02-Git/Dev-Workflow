import Link from "next/link";
import { groupChecklistByStage, truncateChecklistGroups, type ChecklistTask } from "@/lib/checklist-utils";

const PREVIEW_LIMIT = 12;

/**
 * Command Center overview: percent + a capped preview of the checklist
 * (grouped by stage, not the full list). `h-full flex-col` + a `flex-1`
 * content area is the standard "equal-height dashboard card" pattern —
 * the card grows to fill whatever space its wrapper gives it, and the
 * capped list area absorbs that extra space instead of the card matching
 * a sibling's exact content. The full checklist lives on the Tasks tab;
 * "View all" lands there.
 */
export function LaunchChecklistCard({ projectId, tasks }: { projectId: string; tasks: ChecklistTask[] }) {
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.effectiveStatus === "DONE").length;
  const percent = Math.round((doneCount / tasks.length) * 100);
  const color = percent === 100 ? "#0ca30c" : "#c9720a";

  const byStage = groupChecklistByStage(tasks);
  const { groups: previewGroups, shown } = truncateChecklistGroups(byStage, PREVIEW_LIMIT);
  const remaining = tasks.length - shown;

  return (
    <div className="app-card flex h-full flex-col p-4">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Launch checklist · {doneCount}/{tasks.length}
        </h2>
        <div className="flex-1" />
        <span className="text-lg font-bold" style={{ color }}>
          {percent}%
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">Ready for launch</span>
        <Link
          href={`/projects/${projectId}?tab=tasks#launch-checklist`}
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
        >
          View all
        </Link>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
        {previewGroups.map(([stageName, stageTasks]) => (
          <div key={stageName}>
            <div className="mb-1 text-xs font-semibold text-[#52514e]">{stageName}</div>
            <ul className="space-y-1">
              {stageTasks.map((t) => {
                const done = t.effectiveStatus === "DONE";
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-1.5 text-sm ${
                      done ? "text-muted-foreground line-through" : "text-[#52514e]"
                    }`}
                  >
                    <span className={done ? "text-[#0ca30c]" : "text-[#d03b3b]"}>{done ? "☑" : "☐"}</span>
                    {t.title}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {remaining > 0 && <div className="shrink-0 pt-1 text-xs text-muted-foreground">+{remaining} more</div>}
    </div>
  );
}
