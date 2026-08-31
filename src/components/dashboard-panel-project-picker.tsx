"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDownIcon, CheckIcon, SparklesIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlatformBadge } from "@/components/platform-icon";

type SwitcherProject = {
  id: string;
  name: string;
  clientName: string;
  status: string;
  technologyNames: string[];
};

const PANEL_COOKIE = "dashboard_panel";

/**
 * Lets you override which project the dashboard's Command Center panel
 * shows — it defaults to whichever active project ranks #1 by launch
 * readiness, but any project can be pinned instead via this dropdown.
 * "Auto" clears the override (drops the `panel` query param) to go back
 * to that automatic pick.
 *
 * The choice is also remembered in a cookie, not just the URL, so leaving
 * `/dashboard` for another page and coming back on a plain link still
 * shows whichever project was last pinned instead of resetting to Auto —
 * same pattern as ProjectsViewSwitcher/ProjectsToolbar use for the
 * Projects list's own view/sort/group/tech choices.
 */
export function DashboardPanelProjectPicker({
  projects,
  selectedId,
  isAuto,
}: {
  projects: SwitcherProject[];
  selectedId: string | null;
  isAuto: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Choose which project this panel shows"
            className="flex shrink-0 items-center gap-1 rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          />
        }
      >
        <ChevronsUpDownIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={() => {
            document.cookie = `${PANEL_COOKIE}=; path=/; max-age=0`;
            router.push("/dashboard");
          }}
          className={isAuto ? "bg-[#eef2fb]" : undefined}
        >
          <SparklesIcon className="size-3.5" />
          <span className="flex-1">Auto (highest launch readiness)</span>
          {isAuto && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
        </DropdownMenuItem>
        {projects.map((p) => {
          const isCurrent = !isAuto && p.id === selectedId;
          return (
            <DropdownMenuItem
              key={p.id}
              onClick={() => {
                document.cookie = `${PANEL_COOKIE}=${p.id}; path=/; max-age=31536000`;
                router.push(`/dashboard?panel=${p.id}`);
              }}
              className={isCurrent ? "bg-[#eef2fb]" : undefined}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex shrink-0 -space-x-1.5">
                  {p.technologyNames.slice(0, 2).map((name) => (
                    <PlatformBadge key={name} name={name} size={16} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.clientName}</div>
                </div>
                {isCurrent && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
