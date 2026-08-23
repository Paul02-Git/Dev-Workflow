import { NextResponse } from "next/server";
import { listProjectMessages } from "@/lib/queries/projects";

/**
 * Plain REST GET for the internal Messages tab's polling — deliberately
 * not a Server Action. Server Actions are RPC-shaped and meant to be
 * invoked from a form or a direct call tied to a user gesture; polling one
 * on a setInterval turned out to be unreliable in practice (reported twice
 * as "not realtime" despite the underlying query working correctly when
 * tested directly). A plain fetch() to a route handler is the standard,
 * easy-to-debug mechanism for this — visible in the browser's Network tab,
 * no RPC protocol involved. Auth is inherited from src/proxy.ts, which
 * covers every /api/* route by default (only /login, /handoff, /portal,
 * /intake are excluded) — no separate check needed here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await listProjectMessages(id);
  return NextResponse.json(messages);
}
