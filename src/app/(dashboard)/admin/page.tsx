import Link from "next/link";
import { requirePlatformAdmin, listAllOrganizationsForAdmin } from "@/lib/queries/organizations";

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminPage() {
  await requirePlatformAdmin();
  const orgs = await listAllOrganizationsForAdmin();

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
            <div className="shrink-0 text-xs text-muted-foreground">
              {org.clientCount} client{org.clientCount === 1 ? "" : "s"} · {org.projectCount} project
              {org.projectCount === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
