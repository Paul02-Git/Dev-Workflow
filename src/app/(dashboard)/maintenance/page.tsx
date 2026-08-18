import { listMaintenancePlans, DEFAULT_MAINTENANCE_CHECKLIST } from "@/lib/queries/maintenance";
import { listProjects } from "@/lib/queries/projects";
import { CreateMaintenancePlanForm } from "@/components/create-maintenance-plan-form";
import { MaintenancePlanRow } from "@/components/maintenance-plan-row";

export default async function MaintenancePage() {
  const [plans, projects] = await Promise.all([listMaintenancePlans(), listProjects()]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Maintenance</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        Recurring retainer checklists — separate from the one-time build workflow. No automatic cron runs
        these; generate each cycle by hand when it&apos;s due.
      </p>

      <CreateMaintenancePlanForm projects={projects} defaultChecklist={DEFAULT_MAINTENANCE_CHECKLIST} />

      {plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No maintenance plans yet. Create one for any client on a retainer.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <MaintenancePlanRow key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
