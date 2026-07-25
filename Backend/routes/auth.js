import express from 'express';
import { register, login, getMe, forgotPassword, verifyOTP, resetPassword, refreshToken, verifyEmail, logout } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { loginRateLimit, forgotPasswordRateLimit, otpRateLimit } from '../middleware/rateLimitMiddleware.js';
import validateDto from '../middleware/validateDto.js';
import { emailDto, loginDto, otpDto, refreshTokenDto, registerDto, resetPasswordDto } from '../dtos/authDtos.js';

const router = express.Router();

router.post('/register', validateDto(registerDto), register);
router.post('/login', loginRateLimit, validateDto(loginDto), login);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPasswordRateLimit, validateDto(emailDto), forgotPassword);
router.post('/verify-otp', otpRateLimit, validateDto(otpDto), verifyOTP);
router.post('/reset-password', validateDto(resetPasswordDto), resetPassword);
router.post('/refresh-token', validateDto(refreshTokenDto), refreshToken);
router.post('/verify-email', otpRateLimit, validateDto(otpDto), verifyEmail);
router.post('/logout', authMiddleware, logout);

export default router;
