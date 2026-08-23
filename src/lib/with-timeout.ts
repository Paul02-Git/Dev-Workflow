import { resetDbConnection } from "@/db/client";

/**
 * Races a promise against a timeout so a page can fail fast (and show a
 * real error) instead of hanging forever. Needed specifically because
 * postgres.js's own idle_timeout/max_lifetime do NOT reliably recover a
 * connection that's stuck mid-query (its internal `end()` only force-closes
 * a connection that isn't currently reserved for a query — confirmed by
 * reading node_modules/postgres/cjs/src/connection.js directly) — the
 * failure mode repeatedly hit against this project's Supabase pooler,
 * where a query's connection goes "active"/ClientRead and never resolves.
 * On timeout, also resets the shared connection pool (see
 * db/client.ts's resetDbConnection()) so a stuck connection doesn't
 * permanently poison every query after it.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // A timeout here means some connection in the shared pool is stuck
      // (reserved for a query that will never come back) rather than
      // just slow — see db/client.ts's resetDbConnection() comment. Throw
      // that pool away so the *next* query gets a clean one instead of
      // queuing behind an already-crippled pool.
      resetDbConnection();
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
