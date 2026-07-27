import express from 'express';
import { createContest, getContest, startContest, getContestStatus, markProblem, verifyLeetCodeSubmission } from '../controllers/contestController.js';
import { runCode, submitCode } from '../controllers/judgeController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { verifyLeetCodeRateLimit, judgeRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, createContest);
router.get('/:id', getContest);
router.post('/:id/start', authMiddleware, startContest);
router.get('/:id/status', getContestStatus);
router.post('/:id/mark', authMiddleware, markProblem);
router.post('/:id/verify-leetcode', authMiddleware, verifyLeetCodeRateLimit, verifyLeetCodeSubmission);
router.post('/:id/run', authMiddleware, judgeRateLimit, runCode);
router.post('/:id/submit', authMiddleware, judgeRateLimit, submitCode);

export default router;