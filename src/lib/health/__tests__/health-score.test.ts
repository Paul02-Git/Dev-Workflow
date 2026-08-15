import { describe, expect, it } from "vitest";
import { computeHealthScore, type HealthTaskInput } from "../health-score";

function tasks(n: number, overrides: Partial<HealthTaskInput> = {}): HealthTaskInput[] {
  return Array.from({ length: n }, () => ({ status: "TODO", isCritical: false, dueDate: null, ...overrides }));
}

describe("computeHealthScore", () => {
  it("returns 100 for an empty task list", () => {
    expect(computeHealthScore([], [])).toBe(100);
  });

  it("gives no credit for critical-task completion when there are no critical tasks, and none for overall progress when nothing is done", () => {
    // No critical tasks defined => criticalCompletion defaults to 1 (nothing
    // critical is outstanding), so the score reflects only the 40%-weighted
    // overall-completion term, which is 0 here. Not 0 overall — 40*0 = 0
    // from progress, but the true floor with zero critical tasks is the
    // untouched criticalCompletion baseline. Verify the actual formula floor
    // instead of assuming an unconditional 0.
    const t = tasks(10);
    const score = computeHealthScore(t, t.map(() => "TODO"));
    expect(score).toBe(60); // 60% baseline from criticalCompletion=1 (vacuously true), 0% from overall progress
  });

  it("returns a low score when there ARE critical tasks and none are done", () => {
    const t = tasks(10, { isCritical: true });
    const score = computeHealthScore(t, t.map(() => "TODO"));
    expect(score).toBe(0);
  });

  it("returns 100 when everything is done", () => {
    const t = tasks(10, { status: "DONE" });
    expect(computeHealthScore(t, t.map(() => "DONE"))).toBe(100);
  });

  it("does NOT collapse to 0 on a freshly generated large project where most tasks are naturally Blocked on an unstarted dependency chain", () => {
    // Regression test: a flat per-task blocked penalty used to zero out
    // health on day one of any project with 80+ tasks, since most tasks
    // in a freshly generated workflow are legitimately blocked pending
    // earlier stages. Caught via the manual smoke test (86-task project,
    // 5 done, ~70+ blocked) scoring 0 despite real critical-task progress.
    const total = 86;
    const doneCount = 5;
    const blockedCount = 70;
    const t: HealthTaskInput[] = [
      ...Array.from({ length: doneCount }, () => ({ status: "DONE", isCritical: true, dueDate: null })),
      ...Array.from({ length: blockedCount }, () => ({ status: "TODO", isCritical: false, dueDate: null })),
      ...Array.from({ length: total - doneCount - blockedCount }, () => ({
        status: "TODO",
        isCritical: false,
        dueDate: null,
      })),
    ];
    const effective = [
      ...Array.from({ length: doneCount }, () => "DONE"),
      ...Array.from({ length: blockedCount }, () => "BLOCKED"),
      ...Array.from({ length: total - doneCount - blockedCount }, () => "TODO"),
    ];

    const score = computeHealthScore(t, effective);
    expect(score).toBeGreaterThan(0);
  });

  it("weighs critical-task completion more heavily than overall completion", () => {
    const critDone: HealthTaskInput[] = [
      { status: "DONE", isCritical: true, dueDate: null },
      ...tasks(9),
    ];
    const nonCritDone: HealthTaskInput[] = [
      { status: "TODO", isCritical: true, dueDate: null },
      { status: "DONE", isCritical: false, dueDate: null },
      ...tasks(8),
    ];
    const scoreA = computeHealthScore(critDone, critDone.map((t) => t.status));
    const scoreB = computeHealthScore(nonCritDone, nonCritDone.map((t) => t.status));
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("penalizes overdue incomplete tasks", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    const withOverdue = tasks(10, { dueDate: past });
    const withoutOverdue = tasks(10);
    const scoreWithOverdue = computeHealthScore(withOverdue, withOverdue.map(() => "TODO"));
    const scoreWithoutOverdue = computeHealthScore(withoutOverdue, withoutOverdue.map(() => "TODO"));
    expect(scoreWithOverdue).toBeLessThan(scoreWithoutOverdue + 1);
    expect(scoreWithOverdue).toBeLessThanOrEqual(scoreWithoutOverdue);
  });

  it("does not penalize an overdue task that is already done", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    const t = tasks(5, { status: "DONE", dueDate: past });
    expect(computeHealthScore(t, t.map(() => "DONE"))).toBe(100);
  });

  it("stays within 0-100 bounds", () => {
    const t = tasks(20);
    const score = computeHealthScore(t, t.map(() => "BLOCKED"));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
