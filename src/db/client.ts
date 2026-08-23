import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// A single shared connection, reused via globalThis regardless of
// NODE_ENV — this used to be gated to dev-only (for Next.js hot-reload
// safety), which meant every production/serverless invocation created a
// brand-new client with its own connection pool that was never reused or
// explicitly closed. globalThis persists across warm re-invocations of the
// same serverless instance (a fresh instance just gets a fresh pool, which
// is correct), so caching unconditionally is the standard-recommended
// pattern here, not just a dev convenience.
//
// max: 8, not the original 5 — DATABASE_URL points at Supabase's
// transaction pooler (port 6543), which has its own connection ceiling
// shared across every warm instance hitting it. 5 turned out too tight
// for real usage: a single page load already fans out 4-8 queries via
// Promise.all (see getProjectDetail's two "waves"), and clicking through
// nav links quickly fires a fresh full-page render — with its own query
// burst — on top of whatever the previous, not-yet-finished navigation
// was still doing (Next.js doesn't cancel a page's in-flight server-side
// data fetching just because the client navigated away first; confirmed
// live via a real "destination stream closed early" log line while the
// query underneath kept running). 8 gives more burst headroom without
// eating the whole pooler budget alone.
//
// prepare: false — required under transaction-mode pooling: a prepared
// statement can't safely be reused once pgbouncer might route the next
// query to a different backend connection.
//
// idle_timeout: 20 — postgres.js's default is `null` (never expire an
// idle pooled connection). Over a long-running process (a dev server left
// open for hours, or a warm serverless instance), a socket that's been
// idle a while can go silently dead — a NAT/firewall/pooler-side timeout
// closes it without either side getting a FIN — and postgres.js has no
// way to detect that until the next query is sent down it and just hangs.
// Proactively recycling idle connections every 20s keeps sockets from
// sitting around long enough to go stale in the first place. This does
// NOT cover a connection that's actively reserved for an in-flight query
// when it goes stale/overloaded — idle_timeout only ever applies to
// connections sitting free in the pool — which is what resetPool() below
// is for.
type DrizzleDb = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pgClient?: postgres.Sql;
  __drizzleDb?: DrizzleDb;
};

function createClient(): DrizzleDb {
  const client = postgres(connectionString!, { max: 8, prepare: false, idle_timeout: 20 });
  const drizzleDb = drizzle(client, { schema });
  globalForDb.__pgClient = client;
  globalForDb.__drizzleDb = drizzleDb;
  return drizzleDb;
}

// postgres.js can't force-close a connection that's still "reserved" for
// an in-flight query — confirmed by reading node_modules/postgres/cjs/src/
// connection.js directly, and confirmed live: a burst of rapid page
// navigations (each firing several concurrent queries of its own) can
// pin every connection in the pool as "active"/ClientRead for minutes on
// queries that should take milliseconds, i.e. genuinely stuck, not just
// slow. Once that happens the pool is permanently down those slots for
// the rest of the process's life — every `getProjectDetail`/dashboard
// load times out from then on, not just the one that triggered it.
// withTimeout() calls this on every timeout so the pool that broke gets
// thrown away and replaced, instead of every future query competing for
// an already-crippled one.
//
// The `end({ timeout })` value here is load-bearing, not cosmetic — this
// was originally `timeout: 1` and it was a real bug: reading
// node_modules/postgres/cjs/src/index.js's `end()` shows it races a timer
// against every connection's current query finishing; whichever loses,
// the timer's `destroy()` calls `c.terminate()` on every connection in
// the pool AND rejects every other still-in-flight query on it with
// CONNECTION_DESTROYED — not just the one that prompted the reset. With
// real queries here regularly taking 3-8s, a 1s grace period reliably lost
// that race and killed unrelated, perfectly healthy in-flight queries
// (confirmed live via a CONNECTION_DESTROYED error on an unrelated
// `select ... from projects` lookup moments after an unrelated timeout).
// 30s gives real queries room to finish and close gracefully; only a
// connection still busy after 30s (i.e. actually, permanently stuck —
// exactly the failure mode this exists for) gets force-closed. This runs
// in the background (not awaited by the caller), so a longer grace period
// costs nothing — `db` already points at the fresh pool immediately.
export function resetDbConnection() {
  const stale = globalForDb.__pgClient;
  globalForDb.__pgClient = undefined;
  globalForDb.__drizzleDb = undefined;
  if (stale) {
    stale.end({ timeout: 30 }).catch(() => {});
  }
}

// A Proxy, not a plain `const db = drizzle(...)`, so every one of this
// app's many `db.select()`/`db.insert()` call sites automatically picks
// up the current pool after a resetDbConnection() — without a Proxy,
// every file that imported `db` would be holding its own frozen reference
// to the pool that just got thrown away.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const current = globalForDb.__drizzleDb ?? createClient();
    const value = Reflect.get(current as object, prop, receiver);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
