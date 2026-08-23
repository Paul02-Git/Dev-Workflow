"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVerticalIcon, PauseIcon, PlayIcon, Trash2Icon, DollarSignIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { generateMaintenanceRunAction, updateMaintenancePlanAction, deleteMaintenancePlanAction } from "@/lib/actions";

export type MaintenanceTableRow = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  name: string;
  cadenceDays: number;
  nextDueAt: Date | string;
  lastGeneratedAt: Date | string | null;
  isActive: boolean;
  isPaid: boolean;
};

const BULK_STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused" };

function statusPillFor(plan: MaintenanceTableRow) {
  const due = new Date(plan.nextDueAt);
  const isDue = plan.isActive && due <= new Date();
  if (isDue) return { label: "Due now", className: "bg-[#fef4de] text-[#8a5c00]" };
  if (plan.isActive) return { label: "Active", className: "bg-[#eafaea] text-[#0ca30c]" };
  return { label: "Paused", className: "bg-black/5 text-muted-foreground" };
}

function paidPillFor(plan: MaintenanceTableRow) {
  return plan.isPaid
    ? { label: "Paid", className: "bg-[#eafaea] text-[#0ca30c]" }
    : { label: "Unpaid", className: "bg-[#fbe6e6] text-[#d03b3b]" };
}

export function MaintenanceTable({ plans }: { plans: MaintenanceTableRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, startBulkTransition] = useTransition();

  const allSelected = plans.length > 0 && selected.size === plans.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(plans.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedNames = useMemo(() => plans.filter((p) => selected.has(p.id)).map((p) => p.name), [plans, selected]);
  const confirmDeletePlan = plans.find((p) => p.id === confirmDeleteId) ?? null;

  function applyBulkStatus(status: string) {
    setBulkStatus(status);
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      await Promise.all(ids.map((id) => updateMaintenancePlanAction(id, { isActive: status === "active" })));
      setSelected(new Set());
      setBulkStatus("");
    });
  }

  function confirmBulkDelete() {
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      await Promise.all(ids.map((id) => deleteMaintenancePlanAction(id)));
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
            <Select value={bulkStatus} items={BULK_STATUS_LABELS} disabled={pending} onValueChange={(v) => applyBulkStatus(v as string)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Set status…</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => setBulkDeleteOpen(true)}>
              <Trash2Icon /> Delete
            </Button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:underline">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
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
                  aria-label="Select all plans"
                />
              </th>
              <th className="px-2 py-2.5">Plan Name</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Project</th>
              <th className="px-2 py-2.5">Cadence</th>
              <th className="px-2 py-2.5">Next Due</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Payment</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const pill = statusPillFor(plan);
              const paidPill = paidPillFor(plan);
              const due = new Date(plan.nextDueAt);
              return (
                <tr
                  key={plan.id}
                  onClick={() => router.push(`/projects/${plan.projectId}?tab=settings`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(plan.id)}
                      onChange={() => toggleOne(plan.id)}
                      className="size-3.5 rounded border-border accent-primary"
                      aria-label={`Select ${plan.name}`}
                    />
                  </td>
                  <td className="px-2 py-3 text-sm font-semibold text-foreground">{plan.name}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{plan.clientName}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{plan.projectName}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">every {plan.cadenceDays}d</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{due.toLocaleDateString()}</td>
                  <td className="px-2 py-3">
                    <Badge className={pill.className}>{pill.label}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Badge className={paidPill.className}>{paidPill.label}</Badge>
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Plan actions" />}>
                        <MoreVerticalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await generateMaintenanceRunAction(plan.id);
                            })
                          }
                        >
                          Generate this cycle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            startTransition(() => updateMaintenancePlanAction(plan.id, { isActive: !plan.isActive }))
                          }
                        >
                          {plan.isActive ? <PauseIcon /> : <PlayIcon />} {plan.isActive ? "Pause" : "Resume"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            startTransition(() => updateMaintenancePlanAction(plan.id, { isPaid: !plan.isPaid }))
                          }
                        >
                          <DollarSignIcon /> {plan.isPaid ? "Mark as unpaid" : "Mark as paid"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteId(plan.id)}>
                          <Trash2Icon /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmDeletePlan !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDeletePlan?.name}?</DialogTitle>
            <DialogDescription>This permanently deletes this maintenance plan. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteId) return;
                startTransition(async () => {
                  await deleteMaintenancePlanAction(confirmDeleteId);
                  setConfirmDeleteId(null);
                });
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selected.size} plan{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes {selectedNames.join(", ")}. This can&apos;t be undone.
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
