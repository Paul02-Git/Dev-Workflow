"use client";

import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlatformBadge } from "@/components/platform-icon";
import { ChevronsUpDownIcon, FolderKanbanIcon, CheckIcon } from "lucide-react";

type SwitcherProject = {
  id: string;
  name: string;
  clientName: string;
  status: string;
  technologyNames: string[];
};

export function ProjectSwitcher({ projects }: { projects: SwitcherProject[] }) {
  const router = useRouter();
  const pathname = usePathname();
  // The project whose page is currently open — not project.status, which
  // is the business ACTIVE/ON_HOLD/etc. lifecycle already shown elsewhere.
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-[#52514e] hover:bg-muted"
          />
        }
      >
        <FolderKanbanIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">Projects</span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {projects.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet.</div>
        ) : (
          projects.map((p) => {
            const isCurrent = p.id === activeProjectId;
            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className={isCurrent ? "bg-[#eef2fb]" : undefined}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
                  <div className="flex shrink-0 -space-x-1.5">
                    {p.technologyNames.slice(0, 3).map((name) => (
                      <PlatformBadge key={name} name={name} size={16} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-medium ${isCurrent ? "text-[#184f95]" : "text-foreground"}`}>
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{p.clientName}</div>
                  </div>
                  {isCurrent && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
