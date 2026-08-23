import { NextResponse } from "next/server";
import { listProjectAttachmentsWithUrls } from "@/lib/queries/projects";
import { withTimeout } from "@/lib/with-timeout";

/**
 * Plain REST GET for the Files tab's polling — same reasoning as
 * /api/projects/[id]/messages: a file uploaded through the Comments thread
 * needs to show up in the Files tab without a manual page reload, and a
 * fetch() the browser's Network tab can show directly is the standard,
 * easy-to-verify mechanism for that (a Server Action polled on a timer was
 * tried for messages and was unreliable). Auth is inherited from
 * src/proxy.ts, which covers every /api/* route by default.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const files = await withTimeout(listProjectAttachmentsWithUrls(id), 8000, "files poll");
  return NextResponse.json(files);
}
