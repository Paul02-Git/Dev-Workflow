import Link from "next/link";
import { requirePlatformAdmin, listAllOrganizationsForAdmin, listDeletedOrganizationsForAdmin } from "@/lib/queries/organizations";
import { restoreOrganizationAction, permanentlyDeleteOrganizationAction } from "@/lib/actions";
import { OrganizationRowActions } from "@/components/organization-row-actions";
import { TypeToConfirmButton } from "@/components/type-to-confirm-button";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminPage() {
  // requirePlatformAdmin() and the two list queries below don't depend on
  // each other's results — running them concurrently instead of awaiting
  // the auth check first cuts one full round-trip off every load of this
  // page (this project's Supabase pooler round-trip runs a few hundred ms
  // each, confirmed via direct benchmarking — noticeable specifically
  // right after Restore/Delete, since a Server Action's revalidatePath
  // re-runs this whole page function). If the auth check fails, Promise.all
  // rejects immediately on it, same as if it were awaited alone first — no
  // data is rendered before authorization is confirmed.
  const [, orgs, deletedOrgs] = await Promise.all([
    requirePlatformAdmin(),
    listAllOrganizationsForAdmin(),
    listDeletedOrganizationsForAdmin(),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold">Platform admin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every organization using DEVOS — read-only oversight, not shown to any organization other than yours.
      </p>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {orgs.map((org) => (
          <Link
            key={org.id}
            href={`/admin/organizations/${org.id}`}
            className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-muted"
          >
            <div>
              <div className="font-semibold">{org.name}</div>
              <div className="text-xs text-muted-foreground">
                {org.slug} · joined {formatDate(org.createdAt)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {org.clientCount} client{org.clientCount === 1 ? "" : "s"} · {org.projectCount} project
                {org.projectCount === 1 ? "" : "s"}
              </span>
              <OrganizationRowActions orgId={org.id} orgName={org.name} clientCount={org.clientCount} projectCount={org.projectCount} />
            </div>
          </Link>
        ))}
      </div>

      {deletedOrgs.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold text-[#52514e]">Deleted</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {deletedOrgs.map((org) => {
              return (
                <div key={org.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <div>
                    <div className="font-semibold">{org.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {org.slug} · deleted {formatDate(org.deletedAt!)} ·{" "}
                      {org.eligible ? "past the 30-day grace period" : `30-day grace period ends ${formatDate(org.purgeEligibleAt)}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TypeToConfirmButton
                      id={org.id}
                      action={restoreOrganizationAction}
                      triggerLabel="Restore"
                      dialogTitle={`Restore ${org.name}?`}
                      dialogDescription={
                        <>
                          This unblocks login for <strong>{org.name}</strong> immediately and takes it off the
                          permanent-deletion clock — nothing was actually removed by the soft-delete, so every client, project,
                          and task comes back exactly as it was. Type <strong>RESTORE</strong> below to confirm.
                        </>
                      }
                      confirmWord="RESTORE"
                      confirmLabel="Restore"
                      pendingLabel="Restoring…"
                      confirmVariant="default"
                    />
                    <TypeToConfirmButton
                      id={org.id}
                      action={permanentlyDeleteOrganizationAction}
                      triggerLabel="Delete permanently"
                      triggerClassName="text-[#d03b3b] hover:bg-[#fdf5f5]"
                      dialogTitle={`Permanently delete ${org.name}?`}
                      dialogDescription={
                        <>
                          This removes the organization and every client, project, and task under it. There is no undo and no
                          restore after this — unlike the soft-delete that got it here. Type <strong>DELETE</strong> below to
                          confirm.
                        </>
                      }
                      confirmWord="DELETE"
                      confirmLabel="Delete permanently"
                      pendingLabel="Deleting…"
                      confirmVariant="destructive"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
