"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { PlatformBadge } from "@/components/platform-icon";
import { ProjectRowActions } from "@/components/project-row-actions";
import { launchState } from "@/components/project-pulse-cards";
import { STATUS_LABEL, PRIORITY_DOT, PROJECT_COLOR_PALETTE, progressColor, formatDate } from "@/lib/project-display";
import { hashPick } from "@/lib/hash-color";
import { updateProjectStatusAction, deleteProjectFromListAction } from "@/lib/actions";
import type { ProjectCardData } from "@/components/project-card";

const STATUSES = ["ACTIVE", "ON_HOLD", "LAUNCHED", "ARCHIVED"];
const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s, STATUS_LABEL[s].label]));

function DeadlineCell({ project }: { project: ProjectCardData }) {
  if (project.status === "LAUNCHED" && project.launchedAt) {
    return <span className="text-xs font-medium text-[#0ca30c]">Launched {formatDate(project.launchedAt)}</span>;
  }
  if (!project.targetLaunchDate) return <span className="text-xs text-muted-foreground">—</span>;
  const launch = launchState(project.daysToLaunch);
  return (
    <span className="text-xs" style={{ color: project.daysToLaunch !== null && project.daysToLaunch < 0 ? launch.color : undefined }}>
      {formatDate(project.targetLaunchDate)}
    </span>
  );
}

export function ProjectsTable({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const allSelected = projects.length > 0 && selected.size === projects.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(projects.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedNames = useMemo(
    () => projects.filter((p) => selected.has(p.id)).map((p) => p.name),
    [projects, selected]
  );

  function applyBulkStatus(status: string) {
    setBulkStatus(status);
    const ids = Array.from(selected);
    startTransition(async () => {
      await Promise.all(ids.map((id) => updateProjectStatusAction(id, status)));
      setSelected(new Set());
      setBulkStatus("");
    });
  }

  function confirmBulkDelete() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await Promise.all(ids.map((id) => deleteProjectFromListAction(id)));
      setSelected(new Set());
      setBulkDeleteOpen(false);
    });
  }

  return (
    <div className="app-card overflow-hidden">
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-[#eef2fb] px-4 py-2.5">
          <span className="text-xs font-semibold text-[#2a4d8f]">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Select value={bulkStatus} items={STATUS_LABELS} disabled={pending} onValueChange={(v) => applyBulkStatus(v as string)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Set status…</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => setBulkDeleteOpen(true)}>
              <Trash2Icon /> Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="size-3.5 rounded border-border accent-primary"
                  aria-label="Select all projects"
                />
              </th>
              <th className="px-2 py-2.5">Project Name</th>
              <th className="px-2 py-2.5">Created</th>
              <th className="px-2 py-2.5">Deadline</th>
              <th className="px-2 py-2.5">Progress</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Tech</th>
              <th className="px-2 py-2.5">Priority</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const statusMeta = STATUS_LABEL[p.status] ?? STATUS_LABEL.ACTIVE;
              const progressPercent = p.summary.tasksTotal > 0 ? Math.round((p.summary.tasksDone / p.summary.tasksTotal) * 100) : 0;
              const pColor = progressColor(progressPercent);
              const avatarColor = hashPick(p.clientName, PROJECT_COLOR_PALETTE);
              const nextPriority = p.summary.nextAction?.priority ?? null;

              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted ${
                    p.status === "ARCHIVED" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="size-3.5 rounded border-border accent-primary"
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="max-w-[240px] px-2 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {p.clientName.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.clientName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                  <td className="px-2 py-3">
                    <DeadlineCell project={p} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: pColor }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: pColor }}>
                        {progressPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      {p.technologyNames.slice(0, 3).map((t) => (
                        <PlatformBadge key={t} name={t} size={18} />
                      ))}
                      {p.technologyNames.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{p.technologyNames.length - 3}</span>
                      )}
                      {p.technologyNames.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {nextPriority ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[nextPriority] ?? "#898781" }} />
                        {nextPriority.charAt(0) + nextPriority.slice(1).toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <ProjectRowActions
                      projectId={p.id}
                      projectName={p.name}
                      currentStatus={p.status}
                      clientId={p.clientId}
                      isPinned={p.isPinned}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} project{selected.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              This permanently deletes {selectedNames.join(", ")} and everything under them. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirmBulkDelete}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
