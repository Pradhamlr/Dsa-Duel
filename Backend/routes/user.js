import express from 'express';
import { updateUser, getDebugResults, getSolvedProblems, getProblemStats, getAnalytics, clearSolvedProblems, searchProblems } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, updateUser);
router.get('/problems/search', authMiddleware, searchProblems);
router.get('/problems/solved', authMiddleware, getSolvedProblems);
router.get('/problems/stats', authMiddleware, getProblemStats);
router.get('/problems/analytics', authMiddleware, getAnalytics);
router.delete('/problems/solved', authMiddleware, clearSolvedProblems);
router.get('/debug/results', authMiddleware, getDebugResults);

export default router;