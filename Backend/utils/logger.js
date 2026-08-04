import pino from 'pino';

// One shared logger for the whole process, same posture as database.js's Prisma client
// and redisClient.js's Redis connection. JSON output always -- this is meant to be
// machine-greppable (Render's log viewer, or wherever logs end up piped later), not a
// human-formatted console. `pino-pretty` is a dev-only nicety deliberately not wired in
// here: it's another dependency for a cosmetic difference in an environment (local dev)
// where plain JSON is already perfectly readable in practice.
// Silent during tests -- vitest's own pass/fail output is the signal that matters
// there, and pino-http logging every single test request as JSON would drown it out.
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info')
});
