import express from 'express';
import { createContest, getContest, startContest, getContestStatus, markProblem, verifyLeetCodeSubmission } from '../controllers/contestController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { verifyLeetCodeRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, createContest);
router.get('/:id', getContest);
router.post('/:id/start', authMiddleware, startContest);
router.get('/:id/status', getContestStatus);
router.post('/:id/mark', authMiddleware, markProblem);
router.post('/:id/verify-leetcode', authMiddleware, verifyLeetCodeRateLimit, verifyLeetCodeSubmission);

export default router;