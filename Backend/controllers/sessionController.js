import { withPrisma } from '../utils/database.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  listActiveSessions,
  revokeSessionById,
  revokeAllSessionsForUser,
  getSessionIdFromToken
} from '../services/sessionService.js';
import { getRefreshTokenFromRequest } from '../utils/cookies.js';

export const getSessions = asyncHandler(async (req, res) => {
  const currentSessionId = getSessionIdFromToken(getRefreshTokenFromRequest(req));

  const sessions = await withPrisma((prisma) => listActiveSessions(prisma, req.user.userId));

  res.json({
    sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId
    }))
  });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const currentSessionId = getSessionIdFromToken(getRefreshTokenFromRequest(req));

  if (sessionId === currentSessionId) {
    throw new AppError('Use logout to end your current session', 400, 'CANNOT_REVOKE_CURRENT_SESSION');
  }

  const result = await withPrisma((prisma) => (
    revokeSessionById(prisma, req.user.userId, sessionId, 'user_revoked')
  ));

  if (result.count === 0) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  res.json({ message: 'Session revoked' });
});

export const revokeOtherSessions = asyncHandler(async (req, res) => {
  const currentSessionId = getSessionIdFromToken(getRefreshTokenFromRequest(req));

  await withPrisma((prisma) => (
    revokeAllSessionsForUser(prisma, req.user.userId, 'user_revoked_all', currentSessionId)
  ));

  res.json({ message: 'All other sessions signed out' });
});
