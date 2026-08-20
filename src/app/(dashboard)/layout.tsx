import Link from "next/link";
import Image from "next/image";
import { logoutAction } from "@/lib/auth-actions";
import { CommandPalette } from "@/components/command-palette";
import { SearchTrigger } from "@/components/search-trigger";
import { ProjectSwitcher } from "@/components/project-switcher";
import { listProjectsForSwitcher } from "@/lib/queries/projects";

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
  const switcherProjects = await listProjectsForSwitcher();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-56 shrink-0 border-r border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="shrink-0 rounded-md" />
          <div>
            <div className="text-sm font-semibold leading-tight">
              DEV<span className="text-[#2a78d6]">OS</span>
            </div>
            <div className="text-[11px] text-muted-foreground">MVP</div>
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
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-[#52514e] hover:bg-[#cde2fb] hover:text-[#184f95]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-3">
          <SearchTrigger />
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-[#d03b3b]"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
