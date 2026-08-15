// Seeds the operational reference tables (stages, technologies) that
// projects/tasks reference by foreign key. Template *content* (tasks,
// dependencies, subtasks) intentionally lives in src/data/templates as code,
// not in the DB — the workflow engine reads it directly — so it isn't
// seeded here. Safe to re-run (upserts by unique key).
import { db } from "./client";
import { stages, technologies } from "./schema";
import { STAGES } from "@/data/stages";
import { TECHNOLOGIES } from "@/data/technologies";
import { sql } from "drizzle-orm";

async function main() {
  console.log(`Seeding ${STAGES.length} stages...`);
  for (const [i, stage] of STAGES.entries()) {
    await db
      .insert(stages)
      .values({ key: stage.key, name: stage.name, sortOrder: i })
      .onConflictDoUpdate({
        target: stages.key,
        set: { name: stage.name, sortOrder: i },
      });
  }

  console.log(`Seeding ${TECHNOLOGIES.length} technologies...`);
  for (const tech of TECHNOLOGIES) {
    await db
      .insert(technologies)
      .values({ key: tech.key, name: tech.name, category: tech.category })
      .onConflictDoUpdate({
        target: technologies.key,
        set: { name: tech.name, category: tech.category },
      });
  }

  console.log("Seed complete.");
  await db.execute(sql`select 1`); // keep the pool warm check trivial
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
