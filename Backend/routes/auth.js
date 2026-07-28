import express from 'express';
import { register, login, getMe, forgotPassword, verifyOTP, resetPassword, refreshToken, verifyEmail, logout, startGoogleOAuth, googleOAuthCallback } from '../controllers/authController.js';
import { getSessions, revokeSession, revokeOtherSessions } from '../controllers/sessionController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { loginRateLimit, registerRateLimit, forgotPasswordRateLimit, otpRateLimit } from '../middleware/rateLimitMiddleware.js';
import validateDto from '../middleware/validateDto.js';
import { emailDto, loginDto, otpDto, registerDto, resetPasswordDto } from '../dtos/authDtos.js';

const router = express.Router();

router.post('/register', registerRateLimit, validateDto(registerDto), register);
router.post('/login', loginRateLimit, validateDto(loginDto), login);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPasswordRateLimit, validateDto(emailDto), forgotPassword);
router.post('/verify-otp', otpRateLimit, validateDto(otpDto), verifyOTP);
router.post('/reset-password', otpRateLimit, validateDto(resetPasswordDto), resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/verify-email', otpRateLimit, validateDto(otpDto), verifyEmail);
router.post('/logout', authMiddleware, logout);
router.get('/sessions', authMiddleware, getSessions);
router.delete('/sessions/other', authMiddleware, revokeOtherSessions);
router.delete('/sessions/:sessionId', authMiddleware, revokeSession);
router.get('/google', startGoogleOAuth);
router.get('/google/callback', googleOAuthCallback);

export default router;
