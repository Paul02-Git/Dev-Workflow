"use client";

import { useState } from "react";
import { updateProjectOverviewAction } from "@/lib/actions";
import { IconStatCard, healthState } from "@/components/project-pulse-cards";
import { relativeTime } from "@/lib/format-activity";
import { CalendarIcon, HeartIcon, ListChecksIcon, ClockIcon, PencilIcon } from "lucide-react";

export function ProjectOverviewForm({
  projectId,
  domain,
  targetLaunchDate,
  daysToLaunch,
  healthScore,
  healthUpdatedAt,
  tasksDone,
  tasksTotal,
  lastActivityAt,
  lastActivityActor,
}: {
  projectId: string;
  domain: string | null;
  targetLaunchDate: Date | string | null;
  daysToLaunch: number | null;
  healthScore: number;
  healthUpdatedAt: Date | string;
  tasksDone: number;
  tasksTotal: number;
  lastActivityAt: Date | string | null;
  lastActivityActor: string | null;
}) {
  const [editing, setEditing] = useState(false);

  const health = healthState(healthScore);
  const tasksRemaining = tasksTotal - tasksDone;

  let launchValue = "No date set";
  let launchSub = "Set a target launch date";
  if (targetLaunchDate) {
    launchValue = new Date(targetLaunchDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (daysToLaunch === null) launchSub = "—";
    else if (daysToLaunch < 0) launchSub = `${Math.abs(daysToLaunch)}d overdue`;
    else if (daysToLaunch === 0) launchSub = "Launch day";
    else launchSub = `${daysToLaunch} days to go`;
  }

  return (
    <div>
      {!editing ? (
        <div className="grid grid-cols-2 gap-3">
          <IconStatCard
            icon={<CalendarIcon className="size-3.5" />}
            iconColor="var(--primary)"
            iconBg="color-mix(in oklch, var(--primary) 15%, white)"
            label="Launch date"
            action={
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit overview"
                title="Edit domain / target launch date"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
              >
                <PencilIcon className="size-3" />
              </button>
            }
          >
            <div className="truncate text-lg font-bold text-foreground">{launchValue}</div>
            <div className="text-xs text-muted-foreground">{launchSub}</div>
          </IconStatCard>

          <IconStatCard icon={<HeartIcon className="size-3.5" />} iconColor={health.color} iconBg={health.bg} label="Project health">
            <div className="text-lg font-bold" style={{ color: health.color }}>
              {health.label}
            </div>
            <div className="text-xs text-muted-foreground">Updated {relativeTime(healthUpdatedAt)}</div>
          </IconStatCard>

          <IconStatCard icon={<ListChecksIcon className="size-3.5" />} iconColor="#52514e" iconBg="#f1f0ee" label="Tasks remaining">
            <div className="text-lg font-bold text-foreground">{tasksRemaining}</div>
            <div className="text-xs text-muted-foreground">Of {tasksTotal} total</div>
          </IconStatCard>

          <IconStatCard icon={<ClockIcon className="size-3.5" />} iconColor="var(--primary)" iconBg="color-mix(in oklch, var(--primary) 15%, white)" label="Last activity">
            <div className="truncate text-lg font-bold text-foreground">
              {lastActivityAt ? relativeTime(lastActivityAt) : "No activity yet"}
            </div>
            <div className="text-xs text-muted-foreground">{lastActivityAt ? `By ${lastActivityActor}` : "—"}</div>
          </IconStatCard>
        </div>
      ) : (
        <form
          action={async (formData) => {
            await updateProjectOverviewAction(formData);
            setEditing(false);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[#52514e]">Domain</span>
            <input
              type="text"
              name="domain"
              defaultValue={domain ?? ""}
              placeholder="example.com"
              className="rounded border border-black/15 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[#52514e]">Target launch date</span>
            <input
              type="date"
              name="targetLaunchDate"
              defaultValue={targetLaunchDate ? new Date(targetLaunchDate).toISOString().slice(0, 10) : ""}
              className="rounded border border-black/15 px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
