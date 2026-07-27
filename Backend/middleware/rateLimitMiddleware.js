const rateLimitStore = new Map();

const ipKey = (req) => req.ip;

const identifierKey = (req) => {
  const identifier = req.body?.email || req.body?.username;
  return typeof identifier === 'string' ? identifier.trim().toLowerCase() : null;
};

const userKey = (req) => req.user?.userId || null;

// Two limiter dimensions are needed, not one:
//   - per-IP: stops one attacker hammering many accounts from one address
//   - per-identifier: stops a distributed/botnet attack hammering ONE account from many IPs
// Neither alone covers both attack shapes.
const createRateLimit = (windowMs, maxAttempts, keyFn = ipKey) => {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitStore.get(key);

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxAttempts) {
      return res.status(429).json({
        error: 'Too many attempts. Please try again later.'
      });
    }

    record.count++;
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

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
