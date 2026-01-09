const rateLimitStore = new Map();

const createRateLimit = (windowMs, maxAttempts) => {
  return (req, res, next) => {
    const key = req.ip;
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

// Rate limits for different endpoints
export const loginRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes
export const forgotPasswordRateLimit = createRateLimit(60 * 60 * 1000, 3); // 3 attempts per hour
export const otpRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);