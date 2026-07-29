import { randomUUID, randomBytes, createHash } from 'crypto';
import { redis, ensureRedisConnected } from '../utils/redisClient.js';

// Idle timeout: a session dies if it goes this long without being refreshed.
const REFRESH_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Absolute cap: a session dies after this long no matter how often it's refreshed.
const MAX_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Tolerance window for two requests racing on the same (now-rotated) refresh secret,
// e.g. two tabs both refreshing at once, or a client retrying a dropped response.
const ROTATION_GRACE_MS = 30 * 1000;
const MAX_SESSIONS_PER_USER = 10;

// Must match (or exceed) ACCESS_TOKEN_TTL in authController.js -- an access token can
// never outlive this, so the denylist entry never needs to survive longer than the
// worst-case remaining lifetime of any token that could carry this session's sid.
const ACCESS_TOKEN_DENYLIST_TTL_MS = 15 * 60 * 1000;

// Marks a session's sid as revoked in Redis so authMiddleware can reject any access
// token still carrying it, closing the "stateless JWT stays valid until it naturally
// expires" gap instead of waiting up to 15 minutes for that to happen on its own. Fails
// open (logs and continues) rather than throwing -- the DB-side revocation above this
// in every caller is the source of truth; this is a defense-in-depth speedup on top of
// it, not something that should block the revoke itself if Redis is briefly down.
const denylistSession = async (sessionId) => {
  try {
    await ensureRedisConnected();
    await redis.set(`denylist:session:${sessionId}`, '1', 'PX', ACCESS_TOKEN_DENYLIST_TTL_MS);
  } catch (err) {
    console.error('Failed to denylist session (fail open):', err.message);
  }
};

const denylistSessions = (sessionIds) => Promise.all(sessionIds.map(denylistSession));

const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');

const generateSecret = () => randomBytes(32).toString('base64url');

const parseToken = (rawToken) => {
  if (typeof rawToken !== 'string') return null;
  const separatorIndex = rawToken.indexOf('.');
  if (separatorIndex === -1) return null;

  const sessionId = rawToken.slice(0, separatorIndex);
  const secret = rawToken.slice(separatorIndex + 1);
  if (!sessionId || !secret) return null;

  return { sessionId, secret };
};

const deviceLabelFromUserAgent = (userAgent) => {
  if (!userAgent) return 'Unknown device';

  let browser = 'Unknown browser';
  if (/edg\//i.test(userAgent)) browser = 'Edge';
  else if (/chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/safari\//i.test(userAgent)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/mac os/i.test(userAgent)) os = 'macOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad/i.test(userAgent)) os = 'iOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  return `${browser} on ${os}`;
};

const newExpiry = (createdAt) => {
  const idleExpiry = Date.now() + REFRESH_IDLE_TTL_MS;
  const absoluteExpiry = new Date(createdAt).getTime() + MAX_SESSION_LIFETIME_MS;
  return new Date(Math.min(idleExpiry, absoluteExpiry));
};

const enforceSessionCap = async (prisma, userId) => {
  const activeSessions = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastUsedAt: 'asc' }
  });

  const overflow = activeSessions.length - (MAX_SESSIONS_PER_USER - 1);
  if (overflow <= 0) return;

  const idsToRevoke = activeSessions.slice(0, overflow).map((s) => s.id);
  await prisma.session.updateMany({
    where: { id: { in: idsToRevoke } },
    data: { revokedAt: new Date(), revokedReason: 'session_cap' }
  });
  await denylistSessions(idsToRevoke);
};

/**
 * Starts a brand new session (login, register+verify, OAuth). Not used for rotation.
 */
export const createSession = async (prisma, userId, meta = {}) => {
  await enforceSessionCap(prisma, userId);

  const id = randomUUID();
  const secret = generateSecret();
  const now = new Date();

  await prisma.session.create({
    data: {
      id,
      userId,
      tokenHash: sha256Hex(secret),
      familyId: id,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      deviceLabel: deviceLabelFromUserAgent(meta.userAgent),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: newExpiry(now)
    }
  });

  return { token: `${id}.${secret}`, sessionId: id };
};

/**
 * Validates a refresh token and rotates it. Detects reuse of an already-rotated-away
 * secret and treats it as a signal of theft, revoking the entire session family.
 *
 * Returns one of:
 *   { ok: true, token, userId }
 *   { ok: false, reason: 'INVALID' | 'EXPIRED' | 'REUSE_DETECTED' | 'RACE_LOST' }
 */
export const rotateSession = async (prisma, rawToken, meta = {}) => {
  const parsed = parseToken(rawToken);
  if (!parsed) return { ok: false, reason: 'INVALID' };

  const session = await prisma.session.findUnique({ where: { id: parsed.sessionId } });
  if (!session) return { ok: false, reason: 'INVALID' };

  if (session.revokedAt) return { ok: false, reason: 'INVALID' };
  if (session.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };

  const presentedHash = sha256Hex(parsed.secret);
  const graceCutoff = new Date(Date.now() - ROTATION_GRACE_MS);

  const matchesCurrent = session.tokenHash === presentedHash;
  const matchesRecentPrevious = (
    session.previousHash === presentedHash &&
    session.rotatedAt &&
    session.rotatedAt > graceCutoff
  );

  if (!matchesCurrent && !matchesRecentPrevious) {
    await revokeFamily(prisma, session.familyId, 'reuse_detected');
    return { ok: false, reason: 'REUSE_DETECTED' };
  }

  const newSecret = generateSecret();
  const now = new Date();

  const updateResult = await prisma.session.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      OR: [
        { tokenHash: presentedHash },
        { previousHash: presentedHash, rotatedAt: { gt: graceCutoff } }
      ]
    },
    data: {
      tokenHash: sha256Hex(newSecret),
      previousHash: presentedHash,
      rotatedAt: now,
      lastUsedAt: now,
      expiresAt: newExpiry(session.createdAt),
      userAgent: meta.userAgent || session.userAgent,
      ipAddress: meta.ipAddress || session.ipAddress
    }
  });

  if (updateResult.count === 0) {
    return { ok: false, reason: 'RACE_LOST' };
  }

  return { ok: true, token: `${session.id}.${newSecret}`, userId: session.userId, sessionId: session.id };
};

/**
 * Revokes every session sharing a familyId — the blast radius for a detected theft.
 */
export const revokeFamily = async (prisma, familyId, reason) => {
  const toRevoke = await prisma.session.findMany({ where: { familyId, revokedAt: null }, select: { id: true } });
  await prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason }
  });
  await denylistSessions(toRevoke.map((s) => s.id));
};

/**
 * Revokes the session tied to a specific refresh token (used by "log out this device").
 */
export const revokeSessionByToken = async (prisma, rawToken, reason = 'logout') => {
  const parsed = parseToken(rawToken);
  if (!parsed) return;

  const result = await prisma.session.updateMany({
    where: { id: parsed.sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason }
  });
  if (result.count > 0) await denylistSession(parsed.sessionId);
};

/**
 * Revokes one session by id, scoped to the owning user so one account can't revoke another's.
 */
export const revokeSessionById = async (prisma, userId, sessionId, reason = 'user_revoked') => {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason }
  });
  if (result.count > 0) await denylistSession(sessionId);
  return result;
};

/**
 * Revokes all of a user's sessions, e.g. on password reset. Optionally spare one
 * (the session that just performed the action, so the user isn't logged out of it).
 */
export const revokeAllSessionsForUser = async (prisma, userId, reason, exceptSessionId = null) => {
  const where = {
    userId,
    revokedAt: null,
    ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
  };
  const toRevoke = await prisma.session.findMany({ where, select: { id: true } });
  await prisma.session.updateMany({
    where,
    data: { revokedAt: new Date(), revokedReason: reason }
  });
  await denylistSessions(toRevoke.map((s) => s.id));
};

export const listActiveSessions = async (prisma, userId) => {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      deviceLabel: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true
    }
  });
};

export const getSessionIdFromToken = (rawToken) => parseToken(rawToken)?.sessionId || null;

export const deleteExpiredSessions = async (prisma, olderThanMs = 30 * 24 * 60 * 60 * 1000) => {
  return prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - olderThanMs) } }
  });
};
