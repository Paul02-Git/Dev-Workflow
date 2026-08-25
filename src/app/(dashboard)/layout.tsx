import Image from "next/image";
import { logoutAction } from "@/lib/auth-actions";
import { CommandPalette } from "@/components/command-palette";
import { SearchTrigger } from "@/components/search-trigger";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { listProjectsForSwitcher } from "@/lib/queries/projects";
import { withTimeout } from "@/lib/with-timeout";
import { requireAuth } from "@/lib/auth";
import { isPlatformAdminOrg } from "@/lib/queries/organizations";

// Every page in this group needs live, authenticated, per-request data —
// there's no meaningful static version of a client's task board. Without
// this, Next tries to statically prerender fixed-path pages (/reports,
// /dashboard, /clients, /maintenance...) at BUILD time, which means
// opening real DB connections from the build machine — this is what was
// actually behind the repeated "Supabase pooler connection limit during
// static generation" failures seen on local `next build` runs throughout
// this project's history (previously shrugged off since those builds were
// never deployed) and the CONNECTION_DESTROYED crash on a real Vercel
// deploy. force-dynamic on the layout applies to the whole route subtree.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/templates", label: "Workflow Templates" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await requireAuth();

  // This runs on every page in the app, so it must never be able to take
  // the whole layout down — timeout-protected, and any failure (timeout or
  // otherwise) falls back to an empty switcher instead of throwing, since
  // a missing dropdown is a much smaller problem than every page crashing.
  let switcherProjects: Awaited<ReturnType<typeof listProjectsForSwitcher>> = [];
  try {
    switcherProjects = await withTimeout(listProjectsForSwitcher(organizationId), 5000, "project switcher");
  } catch {
    // swallow — empty switcher is an acceptable degraded state
  }

  // Shows the Admin link only for the platform-owner organization — every
  // /admin page/action re-checks this itself (requirePlatformAdmin), so
  // this is purely cosmetic, not the actual security boundary.
  let showAdminNav = false;
  try {
    showAdminNav = await withTimeout(isPlatformAdminOrg(organizationId), 5000, "platform admin check");
  } catch {
    // swallow — worst case, the nav link is briefly missing, not a security issue
  }
  const nav = showAdminNav ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="shrink-0 rounded-md" />
          <div>
            <div className="text-sm font-semibold leading-tight">
              DEV<span className="text-[#2a78d6]">OS</span>
            </div>
            <div className="text-xs text-muted-foreground">MVP</div>
          </div>
        </div>
        {/* Jumping straight to a specific project is the most frequent
            sidebar action for a solo dev juggling several at once, so it
            gets the prime spot right under the logo. Search still works
            everywhere via Ctrl/Cmd+K; its visible trigger moved to the
            bottom to make room. */}
        <div className="mb-4">
          <ProjectSwitcher projects={switcherProjects} />
        </div>
        <SidebarNav items={nav} />
        <div className="mt-4 border-t border-border pt-3">
          <SearchTrigger />
          <LogoutButton
            action={logoutAction}
            triggerLabel="Log out"
            triggerClassName="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-[#d03b3b]"
          />
        </div>
      </aside>
      <main className="h-screen min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
