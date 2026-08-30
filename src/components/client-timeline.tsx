import { LogInIcon, UploadCloudIcon, MessageCircleIcon, EyeIcon, ActivityIcon } from "lucide-react";
import { ActorAvatar } from "@/components/actor-avatar";
import { formatActivitySentence, relativeTime, type ActivityRow } from "@/lib/format-activity";

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  client_logged_in: LogInIcon,
  client_file_uploaded: UploadCloudIcon,
  client_message_posted: MessageCircleIcon,
  handoff_viewed: EyeIcon,
};

/**
 * Chronological log of what the client themselves actually did on this
 * project — the caller filters `fullActivity` down to actorName === "Client"
 * before passing it in (see getClientActivityTimeline's reasoning: this is
 * a plain client-side filter of data the page already fetches, not a new
 * query). Only ever shows real tracked events, never invented ones — there's
 * no approval workflow in this app, so "approved homepage design" style
 * entries would be fabricated data.
 */
export function ClientTimeline({ activity }: { activity: ActivityRow[] }) {
  return (
    <div className="app-card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Timeline</h2>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No client activity yet.</p>
      ) : (
        <ol className="space-y-4">
          {activity.map((row) => {
            const Icon = ACTION_ICON[row.action] ?? ActivityIcon;
            const { actor, rest } = formatActivitySentence(row);
            return (
              <li key={row.id} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0fb] text-[#2a78d6]">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{actor}</span> {rest}
                  </p>
                  <p className="text-xs text-muted-foreground">{relativeTime(row.createdAt)}</p>
                </div>
                <ActorAvatar name={actor} size={22} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
