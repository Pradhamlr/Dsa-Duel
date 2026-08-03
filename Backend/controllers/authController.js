import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { withPrisma } from '../utils/database.js';
import { sendEmail } from '../utils/sendEmail.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeAllSessionsForUser
} from '../services/sessionService.js';
import { REFRESH_COOKIE_NAME, getRefreshTokenFromRequest } from '../utils/cookies.js';
import { redis, ensureRedisConnected } from '../utils/redisClient.js';

// A registration is only "pending" here, not a real User row -- until the OTP is
// verified, nothing permanent exists in Postgres at all. This is deliberate: the old
// design created the User row immediately (emailVerified: false), which meant a user
// who never came back to verify was stuck forever -- re-registering hit
// USER_ALREADY_EXISTS, and nothing else in the app ever touched emailVerified back to
// true. Storing the attempt in Redis with a TTL matching the OTP's own 10-minute window
// means an abandoned registration just expires on its own (no cleanup job needed), and
// registering again with the same email before verifying simply overwrites the pending
// entry with a fresh OTP -- which is also, for free, what a "resend" does.
const pendingRegistrationKey = (email) => `pending:register:${email}`;
const PENDING_REGISTRATION_TTL_SECONDS = 10 * 60;

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

const getGoogleOAuthClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new AppError('Google OAuth is not configured', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }

  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
};

// sid (the session id, not a per-token jti) lets authMiddleware reject every access
// token belonging to a revoked session in one Redis check, regardless of which of that
// session's several refresh-issued access tokens is being presented -- see
// sessionService.js's denylistSession for where this actually gets written.
const signAccessToken = (user, sessionId) => jwt.sign(
  { userId: user.id, email: user.email, username: user.username, typ: 'access', sid: sessionId },
  process.env.JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

const requestMeta = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ipAddress: req.ip
});

// Issues an access token (JWT) plus a brand new session (opaque refresh token).
// Used for login/register-verify/OAuth — anywhere a fresh session should start.
// Session created first so its id can be embedded as the access token's sid claim.
const issueTokens = async (prisma, user, meta = {}) => {
  const { token: refreshToken, sessionId } = await createSession(prisma, user.id, meta);
  const accessToken = signAccessToken(user, sessionId);
  return { accessToken, refreshToken };
};

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  name: user.name
});

const randomSixDigitOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const refreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/auth'
  };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
};

const createOAuthState = () => jwt.sign(
  { provider: 'google' },
  process.env.JWT_SECRET,
  { expiresIn: '10m' }
);

const verifyOAuthState = (state) => {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    return decoded.provider === 'google';
  } catch {
    return false;
  }
};

const buildOAuthSuccessRedirect = ({ accessToken, user }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const hash = new URLSearchParams({
    accessToken,
    user: JSON.stringify(user)
  });

  return `${clientUrl}/#${hash.toString()}`;
};

const buildOAuthErrorRedirect = (code) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const query = new URLSearchParams({ oauthError: code });

  return `${clientUrl}/?${query.toString()}`;
};

export const register = asyncHandler(async (req, res) => {
  const { email, username, password, name } = req.validatedBody;

  // Real, permanent conflicts only -- an already-verified account, or someone else's
  // taken username. This does NOT fully rule out two people registering the same
  // username within the same pending window (each gets their own Redis entry, keyed by
  // email) -- that race is caught later, at actual User creation time in verifyEmail.
  const existingUser = await withPrisma((prisma) => prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(username ? [{ username }] : [])
      ]
    }
  }));

  if (existingUser) {
    throw new AppError('User already exists', 400, 'USER_ALREADY_EXISTS');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationOTP = randomSixDigitOtp();
  const hashedOTP = await bcrypt.hash(verificationOTP, 10);

  const pending = {
    email,
    username: username || null,
    name: name || username || email.split('@')[0],
    hashedPassword,
    hashedOTP
  };

  await ensureRedisConnected();
  await redis.set(pendingRegistrationKey(email), JSON.stringify(pending), 'EX', PENDING_REGISTRATION_TTL_SECONDS);

  await sendEmail(
    email,
    'Verify Your Email - DSA Duel',
    `Your email verification code is: ${verificationOTP}. This code will expire in 10 minutes.`
  );

  res.status(201).json({
    message: 'Registration successful. Please check your email for verification code.',
    email
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, username, password } = req.validatedBody;
  const meta = requestMeta(req);

  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : [])
        ]
      }
    });

    if (!user || !user.password) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.emailVerified) {
      throw new AppError('Please verify your email before logging in', 403, 'EMAIL_NOT_VERIFIED');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const tokens = await issueTokens(prisma, user, meta);

    return {
      ...tokens,
      user: publicUser(user)
    };
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({
    accessToken: result.accessToken,
    user: result.user
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        createdAt: true,
        lastLogin: true,
        leetcodeUsername: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return { user };
  });

  res.json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validatedBody;

  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { message: 'If an account exists for this email, an OTP has been sent.' };
    }

    const otp = randomSixDigitOtp();
    const hashedOTP = await bcrypt.hash(otp, 10);

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: hashedOTP,
        resetTokenExpiry: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    await sendEmail(
      email,
      'Password Reset OTP',
      `Your OTP for password reset is: ${otp}. This OTP will expire in 5 minutes.`
    );

    return { message: 'If an account exists for this email, an OTP has been sent.' };
  });

  res.json(result);
});

// Registering again with the same email already re-sends a fresh code for free (see
// the pendingRegistrationKey comment above) -- but that means re-typing the whole form.
// This is the same thing as a one-field convenience: a "Resend code" button on the
// verification screen itself, for when the first email got lost/delayed/spam-filtered,
// same as most production signup flows offer. Same enumeration-safe shape as
// forgotPassword -- identical generic response whether no pending registration exists
// (never registered, already verified, or the 10-minute window simply expired) or a
// genuinely fresh code gets sent, so this can't be used to probe registration state.
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.validatedBody;
  const genericMessage = { message: 'If a pending registration exists for this email, a new code has been sent.' };

  await ensureRedisConnected();
  const pendingRaw = await redis.get(pendingRegistrationKey(email));

  if (!pendingRaw) {
    return res.json(genericMessage);
  }

  const pending = JSON.parse(pendingRaw);
  const verificationOTP = randomSixDigitOtp();
  pending.hashedOTP = await bcrypt.hash(verificationOTP, 10);

  // Reset the TTL to a fresh 10 minutes too, not just the OTP -- otherwise a resend
  // right before the original window closes would hand out a code that itself expires
  // almost immediately.
  await redis.set(pendingRegistrationKey(email), JSON.stringify(pending), 'EX', PENDING_REGISTRATION_TTL_SECONDS);

  await sendEmail(
    email,
    'Verify Your Email - DSA Duel',
    `Your email verification code is: ${verificationOTP}. This code will expire in 10 minutes.`
  );

  res.json(genericMessage);
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.validatedBody;

  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    if (new Date() > user.resetTokenExpiry) {
      throw new AppError('OTP has expired', 400, 'OTP_EXPIRED');
    }

    const validOTP = await bcrypt.compare(otp, user.resetToken);
    if (!validOTP) {
      throw new AppError('Invalid OTP', 400, 'INVALID_OTP');
    }

    return { message: 'OTP verified successfully' };
  });

  res.json(result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.validatedBody;

  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    if (new Date() > user.resetTokenExpiry) {
      throw new AppError('OTP has expired', 400, 'OTP_EXPIRED');
    }

    const validOTP = await bcrypt.compare(otp, user.resetToken);
    if (!validOTP) {
      throw new AppError('Invalid OTP', 400, 'INVALID_OTP');
    }

    await prisma.user.update({
      where: { email },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // A password reset means the credential may have been compromised (or the
    // legitimate owner is regaining control from someone else) — kill every
    // existing session so a stale device/attacker session can't linger.
    await revokeAllSessionsForUser(prisma, user.id, 'password_reset');

    return { message: 'Password reset successfully' };
  });

  res.json(result);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const incomingToken = getRefreshTokenFromRequest(req);

  if (!incomingToken) {
    throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
  }

  const meta = requestMeta(req);

  const result = await withPrisma(async (prisma) => {
    const rotation = await rotateSession(prisma, incomingToken, meta);

    if (!rotation.ok) {
      if (rotation.reason === 'REUSE_DETECTED') {
        throw new AppError(
          'Refresh token reuse detected. All sessions have been signed out for your safety.',
          401,
          'SESSION_REVOKED'
        );
      }
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({ where: { id: rotation.userId } });
    if (!user) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    return { accessToken: signAccessToken(user, rotation.sessionId), refreshToken: rotation.token };
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({ accessToken: result.accessToken });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.validatedBody;
  const meta = requestMeta(req);

  await ensureRedisConnected();
  const pendingRaw = await redis.get(pendingRegistrationKey(email));

  // Redis's own TTL already handles "expired" for us -- a missing key means either it
  // never existed or it aged out, and there's no meaningful difference between those
  // two from the caller's side, so both collapse into the same generic error.
  if (!pendingRaw) {
    throw new AppError('Invalid or expired verification code', 400, 'INVALID_VERIFICATION_CODE');
  }

  const pending = JSON.parse(pendingRaw);
  const validOTP = await bcrypt.compare(otp, pending.hashedOTP);
  if (!validOTP) {
    throw new AppError('Invalid verification code', 400, 'INVALID_VERIFICATION_CODE');
  }

  const result = await withPrisma(async (prisma) => {
    let user;
    try {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: pending.email,
          username: pending.username,
          password: pending.hashedPassword,
          name: pending.name,
          emailVerified: true
        }
      });
    } catch (err) {
      // Rare, real race: someone else registered and verified the same email/username
      // while this pending entry was waiting (each pending registration is independent,
      // keyed by email, so username collisions between two different in-flight
      // registrations aren't caught until this exact moment). P2002 is Prisma's unique-
      // constraint-violation code.
      if (err.code === 'P2002') {
        throw new AppError(
          'That email or username was just taken by someone else finishing registration first -- please register again.',
          409,
          'REGISTRATION_CONFLICT'
        );
      }
      throw err;
    }

    await redis.del(pendingRegistrationKey(email));

    const tokens = await issueTokens(prisma, user, meta);

    return {
      ...tokens,
      user: publicUser(user)
    };
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({
    accessToken: result.accessToken,
    user: result.user
  });
});

export const logout = asyncHandler(async (req, res) => {
  const incomingToken = getRefreshTokenFromRequest(req);

  await withPrisma(async (prisma) => {
    if (incomingToken) {
      await revokeSessionByToken(prisma, incomingToken, 'logout');
    }
  });

  clearRefreshCookie(res);
  res.json({ message: 'Logged out successfully' });
});

export const startGoogleOAuth = asyncHandler(async (req, res) => {
  const oauthClient = getGoogleOAuthClient();
  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: GOOGLE_SCOPES,
    state: createOAuthState()
  });

  res.redirect(url);
});

export const googleOAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const meta = requestMeta(req);

  if (error) {
    return res.redirect(buildOAuthErrorRedirect('GOOGLE_OAUTH_DENIED'));
  }

  if (!code || !state || !verifyOAuthState(state)) {
    return res.redirect(buildOAuthErrorRedirect('GOOGLE_OAUTH_INVALID_STATE'));
  }

  const oauthClient = getGoogleOAuthClient();

  try {
    const { tokens } = await oauthClient.getToken(String(code));

    if (!tokens.id_token) {
      throw new AppError('Google did not return an identity token', 401, 'GOOGLE_ID_TOKEN_MISSING');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email;
    const emailVerified = payload?.email_verified === true;
    const name = payload?.name || email?.split('@')[0] || 'Google User';

    if (!googleId || !email || !emailVerified) {
      throw new AppError('Google account email is not verified', 401, 'GOOGLE_EMAIL_NOT_VERIFIED');
    }

    const result = await withPrisma(async (prisma) => {
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId },
            { email }
          ]
        }
      });

      // Safe to auto-link into an existing row unconditionally: the pending-registration
      // redesign means the only two places a User row is ever created (here, and
      // verifyEmail's promotion of a verified pending registration) always set
      // emailVerified: true at creation -- an unverified row can no longer exist to
      // hijack in the first place (see the register()/verifyEmail() comments above).
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || googleId,
            authProvider: user.authProvider || 'google',
            emailVerified: true,
            name: user.name || name,
            lastLogin: new Date()
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            id: randomUUID(),
            email,
            name,
            googleId,
            authProvider: 'google',
            emailVerified: true,
            lastLogin: new Date()
          }
        });
      }

      const tokens = await issueTokens(prisma, user, meta);

      return {
        ...tokens,
        user: publicUser(user)
      };
    });

    setRefreshCookie(res, result.refreshToken);
    return res.redirect(buildOAuthSuccessRedirect({
      accessToken: result.accessToken,
      user: result.user
    }));
  } catch (err) {
    console.error('Google OAuth callback failed:', err);
    return res.redirect(buildOAuthErrorRedirect('GOOGLE_OAUTH_FAILED'));
  }
});
