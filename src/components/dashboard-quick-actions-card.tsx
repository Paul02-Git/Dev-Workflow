import Link from "next/link";
import { FolderPlusIcon, UserPlusIcon, ListTodoIcon, WrenchIcon } from "lucide-react";

const ACTIONS = [
  { href: "/projects/new", label: "New Project", icon: FolderPlusIcon, color: "#2a78d6", bg: "#eef2fb" },
  { href: "/clients", label: "Invite Client", icon: UserPlusIcon, color: "#0ca30c", bg: "#eafaea" },
  { href: "/today", label: "Today's Tasks", icon: ListTodoIcon, color: "#c9720a", bg: "#fef4de" },
  { href: "/maintenance", label: "Maintenance", icon: WrenchIcon, color: "#8a5c00", bg: "#f1f0ee" },
];

/**
 * The welcome banner's companion card - deliberately not more stats
 * (Active/Queue/Blocked/Ready to Launch already have their own row right
 * below this), just fast shortcuts into the four things actually started
 * from scratch rather than drilled into from an existing project.
 */
export function DashboardQuickActionsCard() {
  return (
    <div className="app-card h-full p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2.5 rounded-xl border border-border p-3 transition hover:border-primary/40 hover:shadow-sm"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: action.bg, color: action.color }}
            >
              <action.icon className="size-4.5" />
            </span>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
