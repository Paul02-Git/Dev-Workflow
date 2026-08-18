"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectStatusSelect } from "@/components/project-status-select";
import { AddTaskForm } from "@/components/add-task-form";
import { generateHandoffLinkAction } from "@/lib/actions";
import { MoreVerticalIcon, UsersIcon, LinkIcon, SettingsIcon, CheckCircle2Icon } from "lucide-react";
import { hashPick } from "@/lib/hash-color";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#eef2fb] text-[#2a4d8f]" },
  ON_HOLD: { label: "On Hold", className: "bg-[#fef4de] text-[#8a5c00]" },
  LAUNCHED: { label: "Launched", className: "bg-[#eafaea] text-[#0ca30c]" },
  ARCHIVED: { label: "Archived", className: "bg-black/5 text-muted-foreground" },
};

function projectInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
const PROJECT_COLOR_PALETTE = ["#2a78d6", "#0ca30c", "#c9720a", "#a259ff", "#d03b3b", "#0b8f8f"];
function projectColor(name: string): string {
  return hashPick(name, PROJECT_COLOR_PALETTE);
}

function healthState(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "On track", color: "#0ca30c" };
  if (score >= 60) return { label: "At risk", color: "#c9720a" };
  return { label: "Behind", color: "#d03b3b" };
}

export function ProjectHeader({
  projectId,
  projectName,
  projectType,
  status,
  clientId,
  clientName,
  handoffToken,
  launchedAt,
  launchReady,
  healthScore,
  stages,
}: {
  projectId: string;
  projectName: string;
  projectType: string;
  status: string;
  clientId: string;
  clientName: string;
  handoffToken: string | null;
  launchedAt: Date | string | null;
  launchReady: boolean;
  healthScore: number;
  stages: readonly { key: string; name: string }[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const health = healthState(healthScore);
  const statusMeta = STATUS_LABEL[status] ?? { label: status, className: "bg-black/5 text-muted-foreground" };

  async function copyHandoffLink() {
    let token = handoffToken;
    if (!token) token = await generateHandoffLinkAction(projectId);
    await navigator.clipboard.writeText(`${window.location.origin}/handoff/${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-4">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/projects" />}>Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/clients/${clientId}`} />}>{clientName}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{projectName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: projectColor(projectName) }}
          >
            {projectInitial(projectName)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{projectName}</h1>
              <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
              {launchReady && (
                <Badge className="gap-1 bg-[#eafaea] text-[#0ca30c]">
                  <CheckCircle2Icon className="size-3" /> Ready for Launch
                </Badge>
              )}
              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: health.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.color }} />
                {health.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {projectType}
              {launchedAt && <span> · Launched {new Date(launchedAt).toLocaleDateString()}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProjectStatusSelect projectId={projectId} status={status} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Quick actions" />}>
              <MoreVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/clients/${clientId}`)}>
                <UsersIcon /> View client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyHandoffLink}>
                <LinkIcon /> {copied ? "Copied ✓" : "Copy client handoff link"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}?tab=settings`)}>
                <SettingsIcon /> Project settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AddTaskForm projectId={projectId} stages={stages} />
        </div>
      </div>
    </div>
  );
}
