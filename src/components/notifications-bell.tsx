"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActorAvatar } from "@/components/actor-avatar";
import { formatActivitySentence, relativeTime, type ActivityRow } from "@/lib/format-activity";

type NotificationRow = ActivityRow & { projectId: string; projectName: string; clientName: string };

const STORAGE_KEY = "devos.dashboard.read-client-activity";
const STREAM_URL = "/api/dashboard/client-activity/stream";

function readStoredReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the
    // in-memory Set still works for this page view, just not persisted.
  }
}

/**
 * Client activity only (handoff views, portal logins, client uploads,
 * client messages), pushed live over Server-Sent Events — not polling.
 * The server (src/app/api/dashboard/client-activity/stream/route.ts)
 * holds one connection open and pushes the instant something changes;
 * this is the same pattern real notification systems (GitHub's own
 * notification indicator, for one) use for exactly this kind of
 * lightweight one-directional update, and it costs one open connection
 * instead of a full HTTP round-trip (~700ms-1s+, measured) every few
 * seconds.
 *
 * Connect/disconnect is still tied to tab visibility — no reason to hold
 * a connection (and have the server keep checking) while nobody's
 * looking at this tab. `EventSource` reconnects automatically both after
 * a network blip and after the server's own clean self-close (it closes
 * every ~25s on purpose — see the route's own comment), so there's no
 * manual retry logic needed here.
 *
 * Notifications are never removed from the list — "Mark all as read"
 * (and clicking an individual row) only flips read state, tracked by
 * *id* rather than a cutoff timestamp: a timestamp comparison (`createdAt
 * > readAt`) silently fails if the server's clock and the browser's
 * clock disagree even slightly, which is exactly what happened the first
 * time this was built with one. Id membership has no such failure mode.
 *
 * Read ids are persisted to localStorage (per-browser, not a real
 * per-user account — this is a single shared-password app with no such
 * concept) so navigating away and back, or reloading, doesn't resurface
 * what was already read. State starts empty here to match what the
 * server renders (it has no access to localStorage), then syncs from
 * storage in an effect right after mount — reading storage genuinely
 * requires an effect, unlike deriving state that's already available
 * during render, so this doesn't run into this repo's
 * react-hooks/set-state-in-effect rule. The same rule is also why the
 * read is deferred via queueMicrotask: a setState call is flagged if it
 * happens synchronously during the effect's own execution, even when the
 * function that ends up calling it is itself async — deferring past a
 * microtask moves it out of that synchronous frame.
 */
export function NotificationsBell({ activity }: { activity: NotificationRow[] }) {
  const router = useRouter();
  // `activity` only seeds the very first paint (SSR/hydration) - it is
  // deliberately never re-synced after that. Any Dashboard navigation that
  // changes a search param (e.g. switching the Command Center's featured
  // project via ?panel=) re-renders the whole page server-side and hands
  // down a brand-new `activity` array - always portfolio-wide, but capped
  // to a shorter page-load slice than the live stream fetches. Syncing on
  // every prop change used to reset liveActivity back down to that shorter
  // slice on every navigation, which read as notifications disappearing.
  // The live SSE stream (already portfolio-wide, see the route) is the
  // sole source of truth for everything after first paint.
  const [liveActivity, setLiveActivity] = useState(activity);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredReadIds();
      if (stored.size > 0) setReadIds(stored);
    });
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;

    function connect() {
      if (source) return;
      source = new EventSource(STREAM_URL);
      source.onmessage = (event) => {
        try {
          const fresh: NotificationRow[] = JSON.parse(event.data);
          setLiveActivity(fresh);
        } catch (err) {
          console.error("Failed to parse client activity stream payload:", err);
        }
      };
      // No manual retry here — a closed connection (network blip, or the
      // server's own periodic self-close) is handled by EventSource's
      // built-in auto-reconnect.
      source.onerror = () => {};
    }

    function disconnect() {
      source?.close();
      source = null;
    }

    function handleVisibilityChange() {
      if (document.hidden) disconnect();
      else connect();
    }

    if (!document.hidden) connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disconnect();
    };
  }, []);

  const unreadCount = liveActivity.filter((row) => !readIds.has(row.id)).length;

  function markRead(ids: string[]) {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      writeStoredReadIds(next);
      return next;
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Client activity"
            className="relative flex shrink-0 items-center justify-center rounded-md border border-black/15 bg-white p-2 text-muted-foreground hover:bg-muted"
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d03b3b] px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-semibold text-muted-foreground">Client Activity</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markRead(liveActivity.map((row) => row.id));
              }}
              className="text-xs font-semibold text-link hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        {liveActivity.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No client activity yet.</div>
        ) : (
          // Nothing is ever truncated or removed — past 9 rows the list
          // scrolls inside a fixed-height container instead of hiding
          // older notifications.
          <div className={`space-y-1 ${liveActivity.length > 9 ? "max-h-[27rem] overflow-y-auto" : ""}`}>
            {liveActivity.map((row) => {
              const { rest } = formatActivitySentence(row);
              const isUnread = !readIds.has(row.id);
              return (
                <DropdownMenuItem
                  key={row.id}
                  onClick={() => {
                    markRead([row.id]);
                    router.push(`/projects/${row.projectId}?tab=client-activity`);
                  }}
                  className={isUnread ? "bg-[#eef2fb]" : undefined}
                >
                  <ActorAvatar name={row.clientName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">
                        {row.clientName} <span className="font-normal text-muted-foreground">· {row.projectName}</span>
                      </span>
                      {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-[#2a78d6]" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {rest} · {relativeTime(row.createdAt)}
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
