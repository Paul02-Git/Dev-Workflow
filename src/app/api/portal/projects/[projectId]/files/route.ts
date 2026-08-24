import { NextResponse } from "next/server";
import { verifyClientOwnsProjectBySession } from "@/lib/queries/clients";
import { getClientVisibleFiles } from "@/lib/queries/projects";
import { requireClientAuth } from "@/lib/auth";
import { withTimeout } from "@/lib/with-timeout";

/**
 * Plain REST GET for the public Client Workspace's Files polling — same
 * reasoning as /api/portal/projects/[projectId]/messages. Gated by the
 * client's own session cookie plus the ownership check (not src/proxy.ts,
 * which excludes /api/portal), so a logged-in client can only ever read
 * their own project's file list.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const files = await withTimeout(
    (async () => {
      let clientId: string;
      try {
        ({ clientId } = await requireClientAuth());
      } catch {
        return "forbidden" as const;
      }
      if (!(await verifyClientOwnsProjectBySession(clientId, projectId))) return "forbidden" as const;
      return getClientVisibleFiles(projectId);
    })(),
    8000,
    "portal files poll"
  );
  if (files === "forbidden") return NextResponse.json([], { status: 403 });
  return NextResponse.json(files);
}
