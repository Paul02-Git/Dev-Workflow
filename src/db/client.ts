import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// A single shared connection in dev; Next.js hot-reload safe via globalThis.
const globalForDb = globalThis as unknown as { __pgClient?: postgres.Sql };

const client =
  globalForDb.__pgClient ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
