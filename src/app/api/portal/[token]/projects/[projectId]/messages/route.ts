import { NextResponse } from "next/server";
import { verifyClientOwnsProject } from "@/lib/queries/clients";
import { listProjectMessages } from "@/lib/queries/projects";
import { withTimeout } from "@/lib/with-timeout";

/**
 * Plain REST GET for the public Client Portal's Comments polling — same
 * reasoning as /api/projects/[id]/messages (a route handler, not a Server
 * Action, is the more reliable mechanism for a setInterval poll). Public,
 * excluded from src/proxy.ts's auth gate alongside /portal and /intake —
 * gated instead by the ownership check below, so a client can only ever
 * read their own project's thread even if they guess a projectId.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; projectId: string }> }
) {
  const { token, projectId } = await params;
  const messages = await withTimeout(
    (async () => {
      const organizationId = await verifyClientOwnsProject(token, projectId);
      if (!organizationId) return "forbidden" as const;
      return listProjectMessages(projectId, organizationId);
    })(),
    8000,
    "portal messages poll"
  );
  if (messages === "forbidden") return NextResponse.json([], { status: 403 });
  return NextResponse.json(messages);
}
