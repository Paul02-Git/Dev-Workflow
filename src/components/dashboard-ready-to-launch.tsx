import Link from "next/link";
import { CheckCircle2Icon, RocketIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { SquarePlatformIcon } from "@/components/platform-icon";
import type { ReadyToLaunchSummary } from "@/lib/queries/projects";

type ReadyToLaunchRow = ReadyToLaunchSummary & { primaryTech: string | null };

export function DashboardReadyToLaunch({ items }: { items: ReadyToLaunchRow[] }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eafaea] text-[#0ca30c]">
            <RocketIcon className="size-5" />
          </span>
          <CardTitle>Ready To Launch</CardTitle>
        </div>
        {items.length > 0 && (
          <CardAction>
            <Link
              href="/projects"
              className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
            >
              View all
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No projects close to launch yet.</p>
        ) : (
          <>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.projectId}>
                  <Link
                    href={`/projects/${item.projectId}?tab=launch`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 text-sm hover:bg-muted"
                  >
                    {item.primaryTech ? (
                      <SquarePlatformIcon name={item.primaryTech} size={30} />
                    ) : (
                      <span className="h-[30px] w-[30px] shrink-0 rounded-[4px] bg-black/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">{item.projectName}</div>
                      <div className="mb-1.5 text-xs text-muted-foreground">Launch Score: {item.launchScorePercent}%</div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-[#0ca30c]"
                          style={{ width: `${item.launchScorePercent}%` }}
                        />
                      </div>
                    </div>
                    <CheckCircle2Icon className="size-6 shrink-0 text-[#0ca30c]" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
