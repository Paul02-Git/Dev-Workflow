"use client";

import { useState, useTransition } from "react";
import { MoreVerticalIcon, PauseIcon, PlayIcon, PencilIcon, Trash2Icon, DollarSignIcon } from "lucide-react";
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

type Plan = {
  id: string;
  name: string;
  cadenceDays: number;
  checklistTemplate: string;
  nextDueAt: Date | string;
  lastGeneratedAt: Date | string | null;
  isActive: boolean;
  isPaid: boolean;
};

/**
 * One plan's row inside a project group inside a client card (see
 * MaintenanceClientCard) — deliberately not its own bordered card. The
 * client card's border and the project heading above already give it
 * enough visual containment; another border here would just be a third
 * layer of nesting.
 */
export function MaintenancePlanItem({ plan }: { plan: Plan }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [checklist, setChecklist] = useState(plan.checklistTemplate);
  const [cadence, setCadence] = useState(plan.cadenceDays);
  const [generating, setGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const due = new Date(plan.nextDueAt);
  const isDue = plan.isActive && due <= new Date();

  const statusPill = isDue
    ? { label: "Due now", className: "bg-[#fef4de] text-[#8a5c00]" }
    : plan.isActive
      ? { label: "Active", className: "bg-[#eafaea] text-[#0ca30c]" }
      : { label: "Paused", className: "bg-black/5 text-muted-foreground" };

  const paidPill = plan.isPaid
    ? { label: "Paid", className: "bg-[#eafaea] text-[#0ca30c]" }
    : { label: "Unpaid", className: "bg-[#fbe6e6] text-[#d03b3b]" };

  const checklistItems = plan.checklistTemplate
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  function handleDelete() {
    startTransition(async () => {
      await deleteMaintenancePlanAction(plan.id);
      setConfirmDelete(false);
    });
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{plan.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${statusPill.className}`}>
              {statusPill.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Every {plan.cadenceDays} days</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Plan actions" />}>
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing((v) => !v)}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => startTransition(() => updateMaintenancePlanAction(plan.id, { isActive: !plan.isActive }))}
            >
              {plan.isActive ? <PauseIcon /> : <PlayIcon />} {plan.isActive ? "Pause" : "Resume"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => startTransition(() => updateMaintenancePlanAction(plan.id, { isPaid: !plan.isPaid }))}
            >
              <DollarSignIcon /> {plan.isPaid ? "Mark as unpaid" : "Mark as paid"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!editing && checklistItems.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-xs font-medium text-link marker:content-none [&::-webkit-details-marker]:hidden">
            What this covers ({checklistItems.length} item{checklistItems.length === 1 ? "" : "s"})
          </summary>
          <ul className="mt-1.5 space-y-1 border-l-2 border-border pl-3">
            {checklistItems.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing ? (
        <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cadence (days)</span>
            <input
              type="number"
              min={1}
              value={cadence}
              onChange={(e) => setCadence(Number(e.target.value))}
              className="w-24 rounded border border-black/15 px-2 py-1 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Checklist (one item per line)
            </span>
            <textarea
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
              rows={6}
              className="w-full rounded border border-black/15 px-2 py-1 text-xs"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                startTransition(() =>
                  updateMaintenancePlanAction(plan.id, { cadenceDays: cadence, checklistTemplate: checklist })
                );
                setEditing(false);
              }}
              className="rounded-md bg-[#262626] px-2.5 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-end justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Next due</span>
              <span className="text-xs font-semibold text-foreground">{due.toLocaleDateString()}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${paidPill.className}`}>
                {paidPill.label}
              </span>
            </div>
            {plan.lastGeneratedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last generated {new Date(plan.lastGeneratedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={() => {
              setGenerating(true);
              startTransition(async () => {
                await generateMaintenanceRunAction(plan.id);
                setGenerating(false);
              });
            }}
            className="shrink-0 rounded-full bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-black/85 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {plan.name}?</DialogTitle>
            <DialogDescription>This permanently deletes this maintenance plan. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
