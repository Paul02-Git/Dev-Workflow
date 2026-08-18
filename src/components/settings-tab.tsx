import { DeleteButton } from "@/components/delete-button";
import { CreateMaintenancePlanForm } from "@/components/create-maintenance-plan-form";
import { MaintenancePlanRow } from "@/components/maintenance-plan-row";
import { deleteProjectAction } from "@/lib/actions";
import { DEFAULT_MAINTENANCE_CHECKLIST } from "@/lib/queries/maintenance";

type MaintenancePlan = Parameters<typeof MaintenancePlanRow>[0]["plan"];

export function SettingsTab({
  projectId,
  projectName,
  clientName,
  technologies,
  maintenancePlans,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
  technologies: string[];
  maintenancePlans: MaintenancePlan[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Technologies</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Selected when this project was created — reference only, doesn&apos;t regenerate the workflow.
        </p>
        {technologies.length === 0 ? (
          <p className="text-sm text-muted-foreground">None selected.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {technologies.map((name) => (
              <span key={name} className="rounded-full bg-[#eef2fb] px-2.5 py-1 text-xs font-medium text-[#2a4d8f]">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Maintenance</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Recurring retainer checklists for this project. No cron runs these — generate each cycle by hand
          when it&apos;s due (also surfaced on the dashboard when overdue).
        </p>
        <CreateMaintenancePlanForm
          projects={[{ id: projectId, name: projectName, clientName }]}
          defaultChecklist={DEFAULT_MAINTENANCE_CHECKLIST}
          lockedProjectId={projectId}
        />
        {maintenancePlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maintenance plans for this project yet.</p>
        ) : (
          <div className="space-y-3">
            {maintenancePlans.map((plan) => (
              <MaintenancePlanRow key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#f3d4d4] bg-[#fdf5f5] p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#d03b3b]">Danger Zone</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Deletes this project and everything under it — tasks, access items, attachments, activity.
          Cannot be undone.
        </p>
        <DeleteButton action={deleteProjectAction.bind(null, projectId)} label="Delete project" />
      </div>
    </div>
  );
}
