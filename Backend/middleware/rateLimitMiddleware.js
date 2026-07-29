import { redis, ensureRedisConnected } from '../utils/redisClient.js';

const ipKey = (req) => req.ip;

const identifierKey = (req) => {
  const identifier = req.body?.email || req.body?.username;
  return typeof identifier === 'string' ? identifier.trim().toLowerCase() : null;
};

const userKey = (req) => req.user?.userId || null;

// Fixed-window counter via Redis INCR+PEXPIRE: atomic (INCR can't race with itself the
// way a read-then-write on an in-memory Map could), and correct across multiple backend
// instances since the counter lives in one shared place instead of one Map per process.
// Redis's own TTL retires each window on its own -- no manual cleanup sweep needed,
// unlike the in-memory version this replaced.
//
// Fails OPEN on a Redis error (unreachable, timeout, etc.): a rate limiter is a
// mitigation, not the primary defense, and a Redis hiccup taking down real logins would
// be a worse outcome than a brief, logged gap in rate limiting.
const checkRateLimit = async (key, windowMs, maxAttempts) => {
  try {
    await ensureRedisConnected();
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    return count <= maxAttempts;
  } catch (err) {
    console.error('Rate limit check failed, failing open:', err.message);
    return true;
  }
};

// Two limiter dimensions are needed, not one:
//   - per-IP: stops one attacker hammering many accounts from one address
//   - per-identifier: stops a distributed/botnet attack hammering ONE account from many IPs
// Neither alone covers both attack shapes.
const createRateLimit = (windowMs, maxAttempts, keyFn = ipKey) => {
  return async (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const allowed = await checkRateLimit(key, windowMs, maxAttempts);
    if (!allowed) {
      return res.status(429).json({
        error: 'Too many attempts. Please try again later.'
      });
    }
    next();
  };
};

// Chains multiple independent limiters; every one must pass.
const combineRateLimits = (...limiters) => (req, res, next) => {
  let i = 0;
  const run = (err) => {
    if (err) return next(err);
    if (i >= limiters.length) return next();
    limiters[i++](req, res, run);
  };
  run();
};

const perIp = (windowMs, maxAttempts) => createRateLimit(windowMs, maxAttempts, ipKey);
const perIdentifier = (windowMs, maxAttempts) => createRateLimit(windowMs, maxAttempts, identifierKey);

// Rate limits for different endpoints
export const loginRateLimit = combineRateLimits(
  perIp(15 * 60 * 1000, 5),          // 5 attempts per 15 minutes per IP
  perIdentifier(15 * 60 * 1000, 10)  // 10 attempts per 15 minutes per account, regardless of source IP
);

// Every other auth-sensitive route has a rate limit; registration didn't. Per-IP stops
// one source mass-creating accounts, per-identifier stops repeated verification-email
// spam to the same address.
export const registerRateLimit = combineRateLimits(
  perIp(60 * 60 * 1000, 5),
  perIdentifier(60 * 60 * 1000, 3)
);

export const forgotPasswordRateLimit = combineRateLimits(
  perIp(60 * 60 * 1000, 3),
  perIdentifier(60 * 60 * 1000, 3)
);

// OTPs are 6 digits (1e6 space) and short-lived, but guessing must still be capped
// per-account so a botnet can't distribute the guesses across many IPs.
export const otpRateLimit = combineRateLimits(
  perIp(15 * 60 * 1000, 5),
  perIdentifier(15 * 60 * 1000, 8)
);

// Each verification hits an external API (LeetCode) -- keyed per authenticated user,
// not IP, since this route requires auth already. Mount after authMiddleware.
export const verifyLeetCodeRateLimit = createRateLimit(15 * 60 * 1000, 20, userKey);

// Each Run/Submit click compiles + executes real code on the self-hosted Judge0 box --
// more generous than the LeetCode check since iterating on code triggers this often,
// but still capped so a runaway client script can't hammer the droplet.
export const judgeRateLimit = createRateLimit(15 * 60 * 1000, 40, userKey);
