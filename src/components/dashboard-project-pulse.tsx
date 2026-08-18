import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { healthState, ProjectPulseCards } from "@/components/project-pulse-cards";
import type { ProjectPulseSummary } from "@/lib/queries/projects";

export function DashboardProjectPulse({ summary }: { summary: ProjectPulseSummary }) {
  const health = healthState(summary.healthScore);

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={`/projects/${summary.id}`} className="flex min-w-0 items-baseline gap-2 hover:underline">
          <span className="truncate text-sm font-semibold text-foreground">{summary.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{summary.clientName}</span>
        </Link>
        <Badge className="shrink-0" style={{ backgroundColor: health.bg, color: health.color }}>
          {health.label}
        </Badge>
      </div>

      <ProjectPulseCards summary={summary} />
    </div>
  );
}
