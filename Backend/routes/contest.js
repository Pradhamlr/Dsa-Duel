import express from 'express';
import { createContest, getContest, startContest, getContestStatus, markProblem, verifyLeetCodeSubmission, getProblemDetails, contestEvents } from '../controllers/contestController.js';
import { runCode, submitCode } from '../controllers/judgeController.js';
import authMiddleware, { sseAuthMiddleware } from '../middleware/authMiddleware.js';
import { verifyLeetCodeRateLimit, judgeRateLimit, createContestRateLimit } from '../middleware/rateLimitMiddleware.js';
import validateDto from '../middleware/validateDto.js';
import { createContestDto, startContestDto, markProblemDto, problemIndexDto, runSubmitDto } from '../dtos/contestDtos.js';

const router = express.Router();

router.post('/', authMiddleware, createContestRateLimit, validateDto(createContestDto), createContest);
router.get('/:id', getContest);
router.get('/:id/events', sseAuthMiddleware, contestEvents);
router.get('/:id/problem/:index', getProblemDetails);
router.post('/:id/start', authMiddleware, validateDto(startContestDto), startContest);
router.get('/:id/status', getContestStatus);
router.post('/:id/mark', authMiddleware, validateDto(markProblemDto), markProblem);
router.post('/:id/verify-leetcode', authMiddleware, verifyLeetCodeRateLimit, validateDto(problemIndexDto), verifyLeetCodeSubmission);
router.post('/:id/run', authMiddleware, judgeRateLimit, validateDto(runSubmitDto), runCode);
router.post('/:id/submit', authMiddleware, judgeRateLimit, validateDto(runSubmitDto), submitCode);

export default router;