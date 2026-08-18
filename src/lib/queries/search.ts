import { db } from "@/db/client";
import { clients, projects, tasks, stages } from "@/db/schema";
import { eq, or, ilike, and, isNull } from "drizzle-orm";

export type SearchResult = {
  type: "client" | "project" | "task";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const RESULT_LIMIT = 8;

/**
 * Simple ILIKE search across clients, projects, and top-level tasks.
 * Good enough at the freelancer's real scale (dozens, not millions, of
 * rows) — no full-text index needed.
 */
export async function searchAll(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];
  const pattern = `%${query}%`;

  const [clientRows, projectRows, taskRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, company: clients.company })
      .from(clients)
      .where(or(ilike(clients.name, pattern), ilike(clients.company, pattern)))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
        domain: projects.domain,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(or(ilike(projects.name, pattern), ilike(projects.domain, pattern)))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        projectId: tasks.projectId,
        projectName: projects.name,
        stageName: stages.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(stages, eq(tasks.stageId, stages.id))
      .where(and(ilike(tasks.title, pattern), isNull(tasks.parentTaskId)))
      .limit(RESULT_LIMIT),
  ]);

  const results: SearchResult[] = [
    ...clientRows.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.name,
      subtitle: c.company ? `Client · ${c.company}` : "Client",
      href: `/clients/${c.id}`,
    })),
    ...projectRows.map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: p.domain ? `Project · ${p.clientName} · ${p.domain}` : `Project · ${p.clientName}`,
      href: `/projects/${p.id}`,
    })),
    ...taskRows.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: `Task · ${t.projectName} · ${t.stageName}`,
      href: `/projects/${t.projectId}`,
    })),
  ];

  return results;
}
