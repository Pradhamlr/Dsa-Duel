import express from 'express';
import { register, login, getMe, forgotPassword, verifyOTP, resetPassword, refreshToken, verifyEmail } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { loginRateLimit, forgotPasswordRateLimit, otpRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', loginRateLimit, login);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPasswordRateLimit, forgotPassword);
router.post('/verify-otp', otpRateLimit, verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/verify-email', otpRateLimit, verifyEmail);

export default router;