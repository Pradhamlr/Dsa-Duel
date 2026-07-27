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

const signAccessToken = (user) => jwt.sign(
  { userId: user.id, email: user.email, username: user.username, typ: 'access' },
  process.env.JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

const requestMeta = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ipAddress: req.ip
});

// Issues an access token (JWT) plus a brand new session (opaque refresh token).
// Used for login/register-verify/OAuth — anywhere a fresh session should start.
const issueTokens = async (prisma, user, meta = {}) => {
  const accessToken = signAccessToken(user);
  const refreshToken = await createSession(prisma, user.id, meta);
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

  const result = await withPrisma(async (prisma) => {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    });

    if (existingUser) {
      throw new AppError('User already exists', 400, 'USER_ALREADY_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        username,
        password: hashedPassword,
        name: name || username || email.split('@')[0]
      }
    });

    const verificationOTP = randomSixDigitOtp();
    const hashedVerificationOTP = await bcrypt.hash(verificationOTP, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashedVerificationOTP,
        verificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    await sendEmail(
      email,
      'Verify Your Email - DSA Duel',
      `Your email verification code is: ${verificationOTP}. This code will expire in 10 minutes.`
    );

    return {
      message: 'Registration successful. Please check your email for verification code.',
      userId: user.id,
      email: user.email
    };
  });

  res.status(201).json(result);
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
        lastLogin: true
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

    return { accessToken: signAccessToken(user), refreshToken: rotation.token };
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({ accessToken: result.accessToken });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.validatedBody;
  const meta = requestMeta(req);

  const result = await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.verificationToken || !user.verificationTokenExpiry) {
      throw new AppError('Invalid or expired verification code', 400, 'INVALID_VERIFICATION_CODE');
    }

    if (new Date() > user.verificationTokenExpiry) {
      throw new AppError('Verification code has expired', 400, 'VERIFICATION_CODE_EXPIRED');
    }

    const validOTP = await bcrypt.compare(otp, user.verificationToken);
    if (!validOTP) {
      throw new AppError('Invalid verification code', 400, 'INVALID_VERIFICATION_CODE');
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      }
    });

    const tokens = await issueTokens(prisma, updatedUser, meta);

    return {
      ...tokens,
      user: publicUser(updatedUser)
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

      // Only auto-link into an existing account by email when that account is already
      // verified. Otherwise an attacker could pre-register someone's email with a
      // password (unverified) and have this Google login silently verify + adopt it.
      if (user && !user.googleId && !user.emailVerified) {
        throw new AppError(
          'An account with this email already exists. Please verify it or reset your password first.',
          409,
          'EMAIL_ACCOUNT_UNVERIFIED'
        );
      }

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
    if (err instanceof AppError && err.code === 'EMAIL_ACCOUNT_UNVERIFIED') {
      return res.redirect(buildOAuthErrorRedirect('EMAIL_ACCOUNT_UNVERIFIED'));
    }
    return res.redirect(buildOAuthErrorRedirect('GOOGLE_OAUTH_FAILED'));
  }
});
