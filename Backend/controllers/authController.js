import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';
import { sendEmail } from '../utils/sendEmail.js';
import { validateEmail, validatePassword, validateOTP, validateUsername } from '../utils/validation.js';

export const register = async (req, res) => {
  try {
    const { email, username, password, name } = req.body;
    
    // Validate email
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
      }
    }
    
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error });
    }
    
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username required' });
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const result = await withPrisma(async (prisma) => {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email || undefined },
            { username: username || undefined }
          ]
        }
      }).catch((error) => {
        console.error('Database error while checking existing user:', error);
        throw new Error('Database connection failed');
      });
      
      if (existingUser) {
        return { error: 'User already exists', status: 400 };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData = {
        id: randomUUID(),
        name: name || username || email?.split('@')[0]
      };
      
      try {
        userData.email = email;
        userData.username = username;
        userData.password = hashedPassword;
      } catch (e) {
        console.log('Using legacy user schema');
      }
      
      const user = await prisma.user.create({ data: userData });

      const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedVerificationOTP = await bcrypt.hash(verificationOTP, 10);
      const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: hashedVerificationOTP,
          verificationTokenExpiry: verificationExpiry
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

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    if (!email && !username) {
      return res.status(400).json({ error: 'Email or username required' });
    }
    
    // Validate email format if provided
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
      }
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email || undefined },
            { username: username || undefined }
          ]
        }
      }).catch(() => null);
      
      if (!user || !user.password) {
        return { error: 'Invalid credentials', status: 401 };
      }

      if (!user.emailVerified) {
        return { error: 'Please verify your email before logging in', status: 403 };
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return { error: 'Invalid credentials', status: 401 };
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });
      } catch (e) {
        console.log('lastLogin field not available');
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken,
          refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name
        }
      };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
};

export const getMe = async (req, res) => {
  try {
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
        return { error: 'User not found', status: 404 };
      }
      
      return { user };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        return { error: 'User not found', status: 404 };
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await prisma.user.update({
        where: { email },
        data: {
          resetToken: hashedOTP,
          resetTokenExpiry: expiresAt
        }
      });

      await sendEmail(
        email,
        'Password Reset OTP',
        `Your OTP for password reset is: ${otp}. This OTP will expire in 5 minutes.`
      );

      return { message: 'OTP sent to your email' };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }
    
    const otpValidation = validateOTP(otp);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error });
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user || !user.resetToken || !user.resetTokenExpiry) {
        return { error: 'Invalid or expired OTP', status: 400 };
      }

      if (new Date() > user.resetTokenExpiry) {
        return { error: 'OTP has expired', status: 400 };
      }

      const validOTP = await bcrypt.compare(otp, user.resetToken);
      if (!validOTP) {
        return { error: 'Invalid OTP', status: 400 };
      }

      return { message: 'OTP verified successfully' };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }
    
    const otpValidation = validateOTP(otp);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error });
    }
    
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user || !user.resetToken || !user.resetTokenExpiry) {
        return { error: 'Invalid or expired OTP', status: 400 };
      }

      if (new Date() > user.resetTokenExpiry) {
        return { error: 'OTP has expired', status: 400 };
      }

      const validOTP = await bcrypt.compare(otp, user.resetToken);
      if (!validOTP) {
        return { error: 'Invalid OTP', status: 400 };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      return { message: 'Password reset successfully' };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const result = await withPrisma(async (prisma) => {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'refresh') {
        return { error: 'Invalid token type', status: 401 };
      }

      const user = await prisma.user.findUnique({ 
        where: { id: decoded.userId }
      });
      
      if (!user || user.refreshToken !== refreshToken || new Date() > user.refreshTokenExpiry) {
        return { error: 'Invalid or expired refresh token', status: 401 };
      }

      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const newRefreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: newRefreshToken,
          refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return { 
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }
    
    const otpValidation = validateOTP(otp);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error });
    }

    const result = await withPrisma(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user || !user.verificationToken || !user.verificationTokenExpiry) {
        return { error: 'Invalid or expired verification code', status: 400 };
      }

      if (new Date() > user.verificationTokenExpiry) {
        return { error: 'Verification code has expired', status: 400 };
      }

      const validOTP = await bcrypt.compare(otp, user.verificationToken);
      if (!validOTP) {
        return { error: 'Invalid verification code', status: 400 };
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { email },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
          refreshToken,
          refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name
        }
      };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Failed to verify email' });
  }
};