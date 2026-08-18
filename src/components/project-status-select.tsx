"use client";

import { useTransition } from "react";
import { updateProjectStatusAction } from "@/lib/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["ACTIVE", "ON_HOLD", "LAUNCHED", "ARCHIVED"];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  LAUNCHED: "Launched",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--primary)",
  ON_HOLD: "#c9720a",
  LAUNCHED: "#0ca30c",
  ARCHIVED: "#898781",
};

export function ProjectStatusSelect({ projectId, status }: { projectId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      items={STATUS_LABELS}
      disabled={pending}
      onValueChange={(value) => startTransition(() => updateProjectStatusAction(projectId, value as string))}
    >
      <SelectTrigger className="h-8">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
