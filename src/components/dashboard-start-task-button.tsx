"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDashboardTaskAction } from "@/lib/actions";

export function DashboardStartTaskButton({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await startDashboardTaskAction(taskId);
          router.push(`/projects/${projectId}?tab=tasks`);
        });
      }}
      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
    >
      {pending ? "Starting…" : "Start Task"}
    </button>
  );
}
