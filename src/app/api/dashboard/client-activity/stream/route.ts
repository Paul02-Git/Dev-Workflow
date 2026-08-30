import { listRecentActivityAcrossProjects } from "@/lib/queries/projects";
import { isClientActivity } from "@/lib/format-activity";
import { withTimeout } from "@/lib/with-timeout";
import { requireAuth } from "@/lib/auth";

// Never statically cache/optimize a streaming response.
export const dynamic = "force-dynamic";
// Ask Vercel for up to this much runtime; the session below closes itself
// well before this so a real deploy never gets cut off mid-write.
export const maxDuration = 30;

const CHECK_INTERVAL_MS = 3000;
const SESSION_DURATION_MS = 25000;

/**
 * Server-Sent Events, not polling — how large notification systems
 * (GitHub's own notification indicator, for one) actually push updates:
 * one persistent connection instead of the client re-requesting on a
 * timer. The server still checks the DB on an interval internally
 * (there's no DB-level change feed wired up here), but that check reuses
 * one open connection instead of paying full HTTP-request overhead
 * (~700ms-1s+, measured) on every tick — and pushes the instant something
 * actually changes, not on the client's next scheduled poll.
 *
 * The session self-closes after ~25s (well inside the 30s maxDuration
 * above) rather than staying open indefinitely — serverless functions
 * aren't meant to run forever, and typical hosting plans cap duration
 * well below "forever" anyway. EventSource reconnects automatically on a
 * clean close exactly like it does after a network blip, so this is
 * invisible to the client; see notifications-bell.tsx's connect/reconnect
 * handling.
 */
export async function GET() {
  const { organizationId } = await requireAuth();
  const encoder = new TextEncoder();

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSignature: string | null = null;

      function send(data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      }

      async function checkAndSend(force: boolean) {
        if (closed) return;
        try {
          const activity = await withTimeout(listRecentActivityAcrossProjects(organizationId, 40), 8000, "client activity stream check");
          const clientActivity = activity.filter(isClientActivity);
          const signature = `${clientActivity.length}:${clientActivity[0]?.id ?? ""}`;
          if (force || signature !== lastSignature) {
            lastSignature = signature;
            send(clientActivity);
          }
        } catch (err) {
          console.error("Client activity stream check failed:", err);
        }
      }

      await checkAndSend(true);
      intervalId = setInterval(() => void checkAndSend(false), CHECK_INTERVAL_MS);
      timeoutId = setTimeout(() => {
        closed = true;
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting — fine
        }
      }, SESSION_DURATION_MS);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
