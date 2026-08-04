import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { redis, ensureRedisConnected } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';

// A revoked session's already-issued access tokens are otherwise valid until their own
// 15-minute JWT expiry, since verifying a stateless JWT never touches the DB. This
// closes that gap: sessionService.js's denylistSession writes here the moment any of
// its revoke paths runs. Fails OPEN on a Redis error -- a revoked session staying valid
// for the outage's duration is judged a better outcome than every authenticated
// request in the app failing during a Redis blip (confirmed with the user, not assumed).
const isSessionDenylisted = async (sid) => {
  if (!sid) return false; // tokens signed before this feature shipped have no sid -- nothing to check, they age out within 15m regardless
  try {
    await ensureRedisConnected();
    return (await redis.exists(`denylist:session:${sid}`)) === 1;
  } catch (err) {
    logger.warn({ event: 'redis_failopen', check: 'session_denylist', err: err.message }, 'Denylist check failed, failing open');
    return false;
  }
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return next(new AppError('Access token required', 401, 'ACCESS_TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.typ !== 'access') {
      return next(new AppError('Invalid token', 403, 'INVALID_TOKEN'));
    }

    if (await isSessionDenylisted(decoded.sid)) {
      return next(new AppError('Session revoked', 401, 'SESSION_REVOKED'));
    }

    req.user = decoded;
    req.log.setBindings({ userId: decoded.userId });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 403, 'INVALID_TOKEN'));
  }
};

// EventSource (used for the live contest SSE stream) can't set custom headers, so the
// access token has to travel as a query param instead of the Authorization header.
// Same verification logic as authMiddleware, just a different token source -- kept in
// this file so the two auth paths can't silently drift apart.
export const sseAuthMiddleware = async (req, res, next) => {
  const token = req.query.token;

  if (!token) {
    return next(new AppError('Access token required', 401, 'ACCESS_TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.typ !== 'access') {
      return next(new AppError('Invalid token', 403, 'INVALID_TOKEN'));
    }

    if (await isSessionDenylisted(decoded.sid)) {
      return next(new AppError('Session revoked', 401, 'SESSION_REVOKED'));
    }

    req.user = decoded;
    req.log.setBindings({ userId: decoded.userId });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 403, 'INVALID_TOKEN'));
  }
};

export default authMiddleware;
