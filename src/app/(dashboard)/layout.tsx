import Image from "next/image";
import { CommandPalette } from "@/components/command-palette";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarAccountMenu } from "@/components/sidebar-account-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { listProjectsForSwitcher } from "@/lib/queries/projects";
import { withTimeout } from "@/lib/with-timeout";
import {
  requireAuth,
  getOrganizationActorName,
  getOrganizationContactEmail,
  getOrganizationIsPlatformAdmin,
} from "@/lib/auth";

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
  // otherwise) falls back to a generic/degraded sidebar instead of
  // throwing. The account-info group and the admin-nav check are
  // independent of each other, fired together (not one `await`ed before
  // the other starts) so their round trips overlap instead of stacking —
  // this used to be two sequential `await`s, paying two full round trips
  // back-to-back on literally every page load in the app.
  const accountInfoPromise = withTimeout(
    Promise.all([
      listProjectsForSwitcher(organizationId),
      getOrganizationActorName(organizationId),
      getOrganizationContactEmail(organizationId),
    ]),
    5000,
    "sidebar account info"
  ).catch(() => null);

  // Shows the Admin link only for the platform-owner organization — every
  // /admin page/action re-checks this itself (requirePlatformAdmin), so
  // this is purely cosmetic, not the actual security boundary.
  const showAdminNavPromise = withTimeout(getOrganizationIsPlatformAdmin(organizationId), 5000, "platform admin check").catch(
    () => false
  );

  const [accountInfo, showAdminNav] = await Promise.all([accountInfoPromise, showAdminNavPromise]);
  const switcherProjects: Awaited<ReturnType<typeof listProjectsForSwitcher>> = accountInfo?.[0] ?? [];
  const accountName = accountInfo?.[1] ?? "Agency";
  const accountEmail = accountInfo?.[2] ?? "";
  const nav = showAdminNav ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <SidebarProvider className="bg-background text-foreground">
      <Sidebar collapsible="none" className="h-screen w-56 shrink-0 border-r border-border">
        <SidebarHeader className="border-b border-border">
          <div className="flex items-center gap-2 px-1 py-1">
            <Image src="/Devos%20logo.png" alt="" width={52} height={52} priority className="shrink-0 rounded-md" />
            <div>
              <div className="text-sm font-semibold leading-tight">
                DEV<span className="text-[#2a78d6]">OS</span>
              </div>
              <div className="text-xs text-muted-foreground">MVP</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Jumping straight to a specific project is the most frequent
              sidebar action for a solo dev juggling several at once, so it
              gets the prime spot right under the logo. No visible search
              trigger in the sidebar anymore, but Ctrl/Cmd+K still opens the
              command palette from anywhere — CommandPalette below is
              mounted unconditionally. */}
          <SidebarGroup>
            <SidebarGroupContent>
              <ProjectSwitcher projects={switcherProjects} />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav items={nav} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border">
          <SidebarAccountMenu name={accountName} email={accountEmail} />
        </SidebarFooter>
      </Sidebar>
      <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#F5F5F5] p-12">{children}</main>
      <CommandPalette />
    </SidebarProvider>
  );
}
