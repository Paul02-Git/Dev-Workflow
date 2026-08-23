"use client";

import { useState } from "react";
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { groupChecklistByStage, truncateChecklistGroups, type ChecklistTask } from "@/lib/checklist-utils";

const MINIMIZED_LIMIT = 9;

/**
 * Full per-stage launch checklist — its own Launch tab, next to QA (it's
 * cross-cutting critical work — Security, QA, Handoff, etc. — not just
 * build-stage tasks, so it never fit cleanly inside Tasks). Expanded (no
 * scroll) by default; can be minimized down to a capped preview (still at
 * least `MINIMIZED_LIMIT` tasks) when the full list is taking up more room
 * than wanted. Command Center shows its own compact preview
 * (`LaunchChecklistCard`) with a "View all" link that lands here.
 */
export function LaunchChecklistDetail({ tasks }: { tasks: ChecklistTask[] }) {
  const [minimized, setMinimized] = useState(false);
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.effectiveStatus === "DONE").length;
  const percent = Math.round((doneCount / tasks.length) * 100);
  const color = percent === 100 ? "#0ca30c" : "#c9720a";

  const byStage = groupChecklistByStage(tasks);
  const { groups } = minimized
    ? truncateChecklistGroups(byStage, MINIMIZED_LIMIT)
    : { groups: Array.from(byStage.entries()) };

  return (
    <div className="app-card mb-3 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Launch checklist · {doneCount}/{tasks.length}
        </h2>
        <div className="flex-1" />
        <span className="text-lg font-bold" style={{ color }}>
          {percent}%
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">Ready for launch</span>
        <button
          type="button"
          onClick={() => setMinimized((v) => !v)}
          aria-label={minimized ? "Expand checklist" : "Minimize checklist"}
          title={minimized ? "Expand checklist" : "Minimize checklist"}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
        >
          {minimized ? <ChevronsUpDownIcon className="size-4" /> : <ChevronsDownUpIcon className="size-4" />}
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(([stageName, stageTasks]) => (
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
    </div>
  );
}
