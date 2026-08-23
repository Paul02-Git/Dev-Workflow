"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkUpdateTaskStatusAction } from "@/lib/actions";
import { STATUS_COLORS } from "@/components/task-status-select";

type Task = {
  id: string;
  projectId: string;
  title: string;
  isCritical: boolean;
  assignee: string | null;
  stageName: string;
  status: string;
  effectiveStatus: string;
};

export function TaskBulkList({ projectGroups }: { projectGroups: { projectId: string; projectName: string; clientName: string; tasks: Task[] }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(status: string) {
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateTaskStatusAction(ids, status);
      setSelected(new Set());
    });
  }

  return (
    <div className={selected.size > 0 ? "pb-16" : ""}>
      {projectGroups.map((group) => (
        <div key={group.projectId} className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <Link href={`/projects/${group.projectId}`} className="text-sm font-semibold hover:underline">
              {group.projectName} <span className="font-normal text-muted-foreground">· {group.clientName}</span>
            </Link>
            <span className="text-xs text-muted-foreground">{group.tasks.length} task(s)</span>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {group.tasks.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${
                  t.effectiveStatus === "DONE" ? "bg-[#eafaea]" : ""
                } ${selected.has(t.id) ? "bg-[#eef2fb]" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="shrink-0"
                    aria-label={`Select ${t.title}`}
                  />
                  <Link href={`/projects/${t.projectId}`} className="min-w-0 hover:underline">
                    <div className="flex items-center gap-2 font-medium">
                      {t.title}
                      {t.isCritical && (
                        <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-xs font-bold text-[#d03b3b]">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.stageName}
                      {t.assignee && ` · ${t.assignee}`}
                    </div>
                  </Link>
                </div>
                <span
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: STATUS_COLORS[t.effectiveStatus] ?? STATUS_COLORS[t.status] }}
                >
                  {t.effectiveStatus.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-6">
          <div className="flex items-center gap-3 rounded-full border border-border bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
            <span className="font-medium">{selected.size} selected</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => runBulk("DONE")}
              className="rounded-full bg-[#0ca30c] px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Mark Done
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => runBulk("SKIPPED")}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Mark Skipped
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-white/70 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
