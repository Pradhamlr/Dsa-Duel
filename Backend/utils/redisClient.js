import Redis from 'ioredis';

// One shared connection for the whole process, same posture as database.js's shared
// Prisma client -- avoids reconnecting per request.
//
// lazyConnect + a bounded retry strategy rather than ioredis's default (infinite
// exponential backoff, connect immediately on import): if REDIS_URL is misconfigured or
// Upstash is briefly unreachable, callers explicitly decide to fail open (see
// rateLimitMiddleware.js / authMiddleware.js) rather than the whole process blocking on
// a Redis handshake at startup or retrying forever in the background.
export const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000))
});

redis.on('error', (err) => {
  console.error('Redis client error:', err.message);
});

let connectPromise = null;

// Callers await this before their first command on a given request, rather than
// relying on ioredis's own internal queueing -- makes the "Redis is down" case an
// explicit, catchable rejection instead of a command hanging until maxRetriesPerRequest
// gives up.
export function ensureRedisConnected() {
  if (redis.status === 'ready') return Promise.resolve();
  if (!connectPromise) {
    connectPromise = redis.connect().catch((err) => {
      connectPromise = null; // allow a later call to retry rather than staying rejected forever
      throw err;
    });
  }
  return connectPromise;
}
