import express from 'express';
import { updateUser, getLeaderboard, getDebugResults } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, updateUser);
router.get('/leaderboard', getLeaderboard);
router.get('/debug/results', authMiddleware, getDebugResults);

export default router;