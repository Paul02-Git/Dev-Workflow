"use client";

import { useRouter } from "next/navigation";
import { MailIcon, PhoneIcon } from "lucide-react";
import { ClientRowActions } from "@/components/client-row-actions";
import { hashPick } from "@/lib/hash-color";
import { PROJECT_COLOR_PALETTE, formatDate } from "@/lib/project-display";

export type ClientCardData = {
  id: string;
  name: string;
  company: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  projectCount: number;
  healthLabel: string;
  healthColor: string;
  nextLaunchDate: Date | string | null;
  onRetainer: boolean;
  source: string;
  createdAt: Date | string;
  statusLabel: string;
  statusClassName: string;
  sourceLabel: string;
};

export function ClientCard({ client }: { client: ClientCardData }) {
  const router = useRouter();
  const avatarColor = hashPick(client.name, PROJECT_COLOR_PALETTE);
  // Solo-site clients often share their name with their one company/project
  // — showing both would just repeat the same word twice under the avatar.
  const showCompany = client.company && client.company.trim().toLowerCase() !== client.name.trim().toLowerCase();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/clients/${client.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/clients/${client.id}`);
      }}
      className="app-card flex cursor-pointer flex-col gap-3 p-4 transition hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {client.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{client.name}</h3>
            {showCompany && <p className="truncate text-xs text-muted-foreground">{client.company}</p>}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ClientRowActions
            clientId={client.id}
            clientName={client.name}
            company={client.company}
            contactEmail={client.contactEmail}
            contactPhone={client.contactPhone}
            projectCount={client.projectCount}
          />
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <MailIcon className="size-3 shrink-0" />
          {client.contactEmail ?? <span className="italic">No email on file</span>}
        </p>
        {client.contactPhone && (
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <PhoneIcon className="size-3 shrink-0" />
            {client.contactPhone}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${client.statusClassName}`}>
          {client.statusLabel}
        </span>
        {client.onRetainer && (
          <span className="w-fit rounded-full bg-[#eafaea] px-2 py-0.5 text-xs font-bold text-[#0ca30c]">
            On retainer
          </span>
        )}
        {client.source === "intake" && (
          <span className="w-fit rounded-full bg-[#eef2fb] px-2 py-0.5 text-xs font-bold text-primary">
            {client.sourceLabel}
          </span>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <div className="text-xs text-muted-foreground">Projects</div>
          <div className="text-sm font-semibold text-foreground">{client.projectCount}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Health</div>
          <div className="truncate text-sm font-semibold" style={{ color: client.healthColor }}>
            {client.healthLabel}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Launch</div>
          <div className="truncate text-sm font-semibold text-foreground">
            {client.nextLaunchDate ? formatDate(client.nextLaunchDate) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
