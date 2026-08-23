import { WrenchIcon, ActivityIcon, AlertTriangleIcon, UsersIcon, DollarSignIcon } from "lucide-react";
import { IconStatCard } from "@/components/project-pulse-cards";

export function MaintenanceStatRow({
  totalPlans,
  activePlans,
  dueNow,
  unpaid,
  clientsOnRetainer,
}: {
  totalPlans: number;
  activePlans: number;
  dueNow: number;
  unpaid: number;
  clientsOnRetainer: number;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <IconStatCard
        icon={<WrenchIcon className="size-5" />}
        iconColor="#2a78d6"
        iconBg="#e8f0fb"
        label="Total Plans"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{totalPlans}</div>
        <span className="text-xs text-muted-foreground">Across every client</span>
      </IconStatCard>

      <IconStatCard
        icon={<ActivityIcon className="size-5" />}
        iconColor="#0ca30c"
        iconBg="#eafaea"
        label="Active"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{activePlans}</div>
        <span className="text-xs text-muted-foreground">Currently running</span>
      </IconStatCard>

      <IconStatCard
        icon={<AlertTriangleIcon className="size-5" />}
        iconColor={dueNow > 0 ? "#c9720a" : "#0ca30c"}
        iconBg={dueNow > 0 ? "#fef4de" : "#eafaea"}
        label="Due Now"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold" style={{ color: dueNow > 0 ? "#c9720a" : undefined }}>
          {dueNow}
        </div>
        <span className="text-xs text-muted-foreground">{dueNow > 0 ? "Ready to generate" : "Nothing due"}</span>
      </IconStatCard>

      <IconStatCard
        icon={<DollarSignIcon className="size-5" />}
        iconColor={unpaid > 0 ? "#d03b3b" : "#0ca30c"}
        iconBg={unpaid > 0 ? "#fbe6e6" : "#eafaea"}
        label="Unpaid"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold" style={{ color: unpaid > 0 ? "#d03b3b" : undefined }}>
          {unpaid}
        </div>
        <span className="text-xs text-muted-foreground">{unpaid > 0 ? "Awaiting payment" : "All settled"}</span>
      </IconStatCard>

      <IconStatCard
        icon={<UsersIcon className="size-5" />}
        iconColor="#a259ff"
        iconBg="#f2e9fe"
        label="Clients On Retainer"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{clientsOnRetainer}</div>
        <span className="text-xs text-muted-foreground">With at least one plan</span>
      </IconStatCard>
    </div>
  );
}
