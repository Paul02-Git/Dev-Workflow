import { NextResponse } from "next/server";
import { verifyClientOwnsProjectBySession } from "@/lib/queries/clients";
import { listProjectMessages } from "@/lib/queries/projects";
import { requireClientAuth } from "@/lib/auth";
import { withTimeout } from "@/lib/with-timeout";

/**
 * Plain REST GET for the public Client Workspace's Comments polling — same
 * reasoning as /api/projects/[id]/messages (a route handler, not a Server
 * Action, is the more reliable mechanism for a setInterval poll). Gated by
 * the client's own session cookie (checked directly here — this route
 * isn't covered by src/proxy.ts's agency-session gate) plus the ownership
 * check below, so a logged-in client can only ever read their own
 * project's thread even if they guess a projectId.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const messages = await withTimeout(
    (async () => {
      let clientId: string;
      try {
        ({ clientId } = await requireClientAuth());
      } catch {
        return "forbidden" as const;
      }
      const organizationId = await verifyClientOwnsProjectBySession(clientId, projectId);
      if (!organizationId) return "forbidden" as const;
      return listProjectMessages(projectId, organizationId);
    })(),
    8000,
    "portal messages poll"
  );
  if (messages === "forbidden") return NextResponse.json([], { status: 403 });
  return NextResponse.json(messages);
}
