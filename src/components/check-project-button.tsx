"use client";

import { useState, useTransition } from "react";
import { checkProjectAction } from "@/lib/actions";
import type { ForgottenTaskIssue } from "@/lib/health/forgotten-task-rules";

export function CheckProjectButton({ projectId }: { projectId: string }) {
  const [issues, setIssues] = useState<ForgottenTaskIssue[] | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await checkProjectAction(projectId);
            setIssues(result);
          })
        }
        disabled={pending}
        className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b0b0b] hover:bg-[#f9f9f7]"
      >
        {pending ? "Checking…" : "Check Project"}
      </button>

      {issues !== null && (
        <div className="mt-3 rounded-lg border border-black/10 bg-[#fcfcfb] p-4">
          <div className="mb-2 text-xs font-semibold text-[#52514e]">
            {issues.length === 0 ? "No potential issues found" : `Potential issues (${issues.length})`}
          </div>
          {issues.length > 0 && (
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li key={issue.id} className="flex gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#fef4de] text-xs font-bold text-[#8a5c00]">
                    !
                  </span>
                  <div>
                    <div>{issue.message}</div>
                    <div className="text-[11px] text-[#898781]">{issue.area}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
