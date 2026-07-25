import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';
import { sendEmail } from '../utils/sendEmail.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const issueTokens = async (prisma, user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken,
      refreshTokenExpiry: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });

  return { accessToken, refreshToken };
};

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  name: user.name
});

const randomSixDigitOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

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

    const tokens = await issueTokens(prisma, user);

    return {
      ...tokens,
      user: publicUser(user)
    };
  });

  res.json(result);
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

    return { message: 'Password reset successfully' };
  });

  res.json(result);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.validatedBody;

  const result = await withPrisma(async (prisma) => {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.refreshToken !== refreshToken || !user.refreshTokenExpiry || new Date() > user.refreshTokenExpiry) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    return issueTokens(prisma, user);
  });

  res.json(result);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.validatedBody;

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

    const tokens = await issueTokens(prisma, updatedUser);

    return {
      ...tokens,
      user: publicUser(updatedUser)
    };
  });

  res.json(result);
});

export const logout = asyncHandler(async (req, res) => {
  await withPrisma(async (prisma) => {
    await prisma.user.updateMany({
      where: { id: req.user.userId },
      data: {
        refreshToken: null,
        refreshTokenExpiry: null
      }
    });
  });

  res.json({ message: 'Logged out successfully' });
});
