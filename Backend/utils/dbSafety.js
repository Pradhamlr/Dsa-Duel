// Real incident, not a hypothetical: a destructive script once ran successfully against
// the real production Supabase database because DATABASE_URL wasn't explicitly exported
// in the calling shell, and Prisma's own built-in .env auto-loading (separate from --
// and not fixed by -- this app's own dotenv.config() call) silently filled it in from
// Backend/.env instead. The whole real catalog, every contest/result/session/solve-
// history row, was wiped with no backup to recover from.
//
// This check was originally trapped as a local, unexported function inside
// tests/dbHelpers.js, protecting resetDb() only -- a second, completely separate
// unguarded bulk-delete script (clear-database.js, gitignored, never went through a
// PR) was later found with the exact same DATABASE_URL-resolution risk and no guard at
// all. Extracted here so any script that deletes rows unconditionally -- present or
// future -- has an obvious, reusable check to import instead of reinventing (or
// skipping) it.
//
// Deliberately narrow in what it protects: this refuses to run against anything that
// doesn't look like a local/throwaway database, which is correct for a script that
// deletes EVERYTHING unconditionally. It is NOT meant for properly-scoped production
// writes (e.g. a user clearing their own solve history, or a job sweeping expired
// sessions) -- those are supposed to run against the real database, just scoped
// correctly, and applying this check there would break real functionality.
const looksLocal = (url) => /\/\/[^/]*(localhost|127\.0\.0\.1)([:/]|$)/.test(url || '');

export function assertSafeTestDatabase() {
  if (!looksLocal(process.env.DATABASE_URL)) {
    throw new Error(
      'Refusing to run: DATABASE_URL does not look like a local/throwaway database ' +
      '(expected "localhost" or "127.0.0.1" in the connection string). Export ' +
      'DATABASE_URL to a local test Postgres before running this -- do not bypass ' +
      'this check by removing it.'
    );
  }
}

// The exact same class of risk as assertSafeTestDatabase, found only while adding new
// auth tests: the integration test suites call redis.flushdb() unconditionally in their
// own beforeEach, with REDIS_URL (like DATABASE_URL) resolving to the real production
// Upstash instance unless a shell explicitly overrides it to local. Nothing was
// guarding that call at all -- a flushdb() against production wouldn't just lose rate-
// limit counters, it would wipe every currently-revoked session's denylist entry too,
// silently un-revoking every previously-stolen/logged-out session until its access
// token naturally expires (<=15 min). Same fix, same reasoning as the Postgres guard.
export function assertSafeTestRedis() {
  if (!looksLocal(process.env.REDIS_URL)) {
    throw new Error(
      'Refusing to run: REDIS_URL does not look like a local/throwaway instance ' +
      '(expected "localhost" or "127.0.0.1" in the connection string). Export ' +
      'REDIS_URL to a local test Redis before running this -- do not bypass this ' +
      'check by removing it.'
    );
  }
}
