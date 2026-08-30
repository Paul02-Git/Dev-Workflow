"use client";

import { useState, useTransition } from "react";
import {
  generateMaintenanceRunAction,
  updateMaintenancePlanAction,
  deleteMaintenancePlanAction,
} from "@/lib/actions";

type Plan = {
  id: string;
  projectId: string;
  name: string;
  cadenceDays: number;
  checklistTemplate: string;
  nextDueAt: Date | string;
  lastGeneratedAt: Date | string | null;
  isActive: boolean;
  projectName: string;
  clientName: string;
};

export function MaintenancePlanRow({ plan }: { plan: Plan }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [checklist, setChecklist] = useState(plan.checklistTemplate);
  const [cadence, setCadence] = useState(plan.cadenceDays);
  const [generating, setGenerating] = useState(false);

  const due = new Date(plan.nextDueAt);
  const isDue = plan.isActive && due <= new Date();

  return (
    <div className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{plan.name}</span>
            {!plan.isActive && (
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                PAUSED
              </span>
            )}
            {isDue && (
              <span className="rounded-full bg-[#fef4de] px-1.5 py-0.5 text-xs font-bold text-[#8a5c00]">
                DUE
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.projectName} · {plan.clientName} · every {plan.cadenceDays}d
          </div>
          <div className="text-xs text-muted-foreground">
            Next due {due.toLocaleDateString()}
            {plan.lastGeneratedAt && ` · last generated ${new Date(plan.lastGeneratedAt).toLocaleDateString()}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate this cycle's checklist"}
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(() => updateMaintenancePlanAction(plan.id, { isActive: !plan.isActive }))
            }
            className="text-xs text-muted-foreground hover:underline"
          >
            {plan.isActive ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-link hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete maintenance plan "${plan.name}"?`)) {
                startTransition(() => deleteMaintenancePlanAction(plan.id));
              }
            }}
            className="text-xs text-muted-foreground hover:text-[#d03b3b]"
          >
            ×
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
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
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
