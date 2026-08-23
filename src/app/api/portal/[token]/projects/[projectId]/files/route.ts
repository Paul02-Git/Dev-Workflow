import { NextResponse } from "next/server";
import { verifyClientOwnsProject } from "@/lib/queries/clients";
import { getClientVisibleFiles } from "@/lib/queries/projects";
import { withTimeout } from "@/lib/with-timeout";

/**
 * Plain REST GET for the public Client Portal's Files polling — same
 * reasoning as /api/portal/[token]/projects/[projectId]/messages. Gated by
 * the ownership check (not src/proxy.ts, which excludes /api/portal) so a
 * client can only ever read their own project's file list.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; projectId: string }> }
) {
  const { token, projectId } = await params;
  const files = await withTimeout(
    (async () => {
      if (!(await verifyClientOwnsProject(token, projectId))) return "forbidden" as const;
      return getClientVisibleFiles(projectId);
    })(),
    8000,
    "portal files poll"
  );
  if (files === "forbidden") return NextResponse.json([], { status: 403 });
  return NextResponse.json(files);
}
