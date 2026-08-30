"use client";

import { useState, useTransition } from "react";
import { MailIcon, PhoneIcon, GlobeIcon, ExternalLinkIcon, SendIcon, CircleIcon, ClockIcon, CalendarIcon, PaperclipIcon } from "lucide-react";
import { ActorAvatar } from "@/components/actor-avatar";
import { healthState } from "@/components/project-pulse-cards";
import { relativeTime } from "@/lib/format-activity";
import { generateHandoffLinkAction, sendClientMagicLinkAction } from "@/lib/actions";

/** One small square cell in the bento stat grid — compact by design, unlike IconStatCard's natural (taller) sizing elsewhere in the app. Purely local to this bento layout. */
function BentoCell({
  icon,
  color,
  bg,
  label,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-card flex min-w-0 flex-col justify-between p-2.5" style={{ backgroundColor: bg }}>
      <span style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold" style={{ color }}>
          {children}
        </div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/**
 * The hero card for the redesigned Client Activity tab — client identity
 * on the left, at-a-glance stats on the right, primary actions along the
 * bottom. Everything here is data this page/getProjectDetail already
 * fetches (client row, tasksDone/tasksTotal, projectFiles.length) or a
 * cheap client-side filter of fullActivity (lastLoginAt) — no new query
 * was needed for any of it.
 */
export function ClientProfileCard({
  projectId,
  clientId,
  clientName,
  company,
  contactEmail,
  contactPhone,
  clientSince,
  domain,
  handoffToken,
  lastLoginAt,
  tasksDone,
  tasksTotal,
  filesSharedCount,
}: {
  projectId: string;
  clientId: string;
  clientName: string;
  company: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  clientSince: Date | string;
  domain: string | null;
  handoffToken: string | null;
  lastLoginAt: Date | string | null;
  tasksDone: number;
  tasksTotal: number;
  filesSharedCount: number;
}) {
  const [, startTransition] = useTransition();
  const [openingPortal, setOpeningPortal] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const portalActive = !!contactEmail;
  const websiteHref = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : null;
  const donePercent = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const taskHealth = healthState(donePercent);

  function openPortal() {
    setOpeningPortal(true);
    startTransition(async () => {
      try {
        const token = handoffToken ?? (await generateHandoffLinkAction(projectId));
        window.open(`/handoff/${token}`, "_blank", "noopener,noreferrer");
      } finally {
        setOpeningPortal(false);
      }
    });
  }

  function sendMagicLink() {
    setSendingLink(true);
    setLinkSent(false);
    startTransition(async () => {
      try {
        await sendClientMagicLinkAction(clientId);
        setLinkSent(true);
      } finally {
        setSendingLink(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      {/* Identity + actions — its own card. */}
      <div className="app-card min-w-0 flex-1 p-5">
        <div className="flex items-start gap-4">
          <ActorAvatar name={clientName} size={56} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">{clientName}</h1>
            {company && <p className="text-sm text-muted-foreground">{company}</p>}
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-1.5 hover:text-primary">
                  <MailIcon className="size-3.5 shrink-0" /> {contactEmail}
                </a>
              )}
              {contactPhone && (
                <a href={`tel:${contactPhone}`} className="flex items-center gap-1.5 hover:text-primary">
                  <PhoneIcon className="size-3.5 shrink-0" /> {contactPhone}
                </a>
              )}
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary">
                  <GlobeIcon className="size-3.5 shrink-0" /> {domain}
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            disabled={openingPortal}
            onClick={openPortal}
            className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {openingPortal ? "Opening…" : "Open Portal"}
          </button>
          <button
            type="button"
            disabled={!contactEmail || sendingLink}
            onClick={sendMagicLink}
            title={contactEmail ? undefined : "No email on file"}
            className="flex items-center gap-1.5 rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <SendIcon className="size-3.5" />
            {sendingLink ? "Sending…" : linkSent ? "Sent ✓" : "Send Magic Link"}
          </button>
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Email Client
            </a>
          )}
        </div>
      </div>

      {/* Stats — a real bento grid of independently-bordered cards, not
          nested inside the profile card's own border above. One 2x2 hero
          cell (Tasks Done) beside four small 1x1 cells. */}
      <div className="grid h-[152px] grid-cols-4 grid-rows-2 gap-2 lg:w-[440px] lg:shrink-0">
        <div
          className="app-card col-span-2 row-span-2 flex flex-col justify-between p-3.5"
          style={{ backgroundColor: taskHealth.bg }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tasks Done</div>
          <div>
            <div className="text-3xl font-bold" style={{ color: taskHealth.color }}>
              {tasksDone}
              <span className="text-lg text-muted-foreground">/{tasksTotal}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full" style={{ width: `${donePercent}%`, backgroundColor: taskHealth.color }} />
            </div>
          </div>
        </div>

        <BentoCell
          icon={<CircleIcon className="size-3.5 fill-current" />}
          color={portalActive ? "#0ca30c" : "#898781"}
          bg={portalActive ? "#eafaea" : "#f1f0ee"}
          label="Portal"
        >
          {portalActive ? "Active" : "Not set up"}
        </BentoCell>
        <BentoCell icon={<ClockIcon className="size-3.5" />} color="#2a78d6" bg="#e8f0fb" label="Last login">
          {lastLoginAt ? relativeTime(lastLoginAt) : "Never"}
        </BentoCell>
        <BentoCell icon={<CalendarIcon className="size-3.5" />} color="#a259ff" bg="#f2effc" label="Client since">
          {new Date(clientSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
        </BentoCell>
        <BentoCell icon={<PaperclipIcon className="size-3.5" />} color="#c9720a" bg="#fef4de" label="Files shared">
          {filesSharedCount}
        </BentoCell>
      </div>
    </div>
  );
}
