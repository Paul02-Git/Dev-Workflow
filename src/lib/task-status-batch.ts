"use client";

import { bulkUpdateTaskStatusAction } from "@/lib/actions";

// Rapid-fire checkbox clicks (checking off a whole checklist) used to fire
// one full page-revalidating Server Action per click — each one re-running
// every heavy query on the project page (getProjectDetail included). Under
// real DB load that's the same connection-pool-contention pattern already
// diagnosed and fixed for chat this session, just triggered by ticking
// several tasks quickly instead of sending several messages quickly.
// Coalescing consecutive clicks into one bulk update, deferred by
// FLUSH_DELAY_MS of inactivity, turns a burst of N clicks into one server
// round-trip (or a small constant few, if some were checks and others
// unchecks) instead of N.
const FLUSH_DELAY_MS = 900;

let pending = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  flushTimer = null;
  const changes = pending;
  pending = new Map();

  const taskIdsByStatus = new Map<string, string[]>();
  for (const [taskId, status] of changes) {
    if (!taskIdsByStatus.has(status)) taskIdsByStatus.set(status, []);
    taskIdsByStatus.get(status)!.push(taskId);
  }
  for (const [status, taskIds] of taskIdsByStatus) {
    bulkUpdateTaskStatusAction(taskIds, status).catch((err) => {
      console.error("Batched task status update failed:", err);
    });
  }
}

/** Queues a task's status change for the next batched flush — see module comment. Last write for a given taskId within the debounce window wins. */
export function queueTaskStatusChange(taskId: string, status: string) {
  pending.set(taskId, status);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}
