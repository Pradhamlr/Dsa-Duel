import express from 'express';
import { createContest, getContest, startContest, getContestStatus, markProblem } from '../controllers/contestController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, createContest);
router.get('/:id', getContest);
router.post('/:id/start', authMiddleware, startContest);
router.get('/:id/status', getContestStatus);
router.post('/:id/mark', authMiddleware, markProblem);

export default router;