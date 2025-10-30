import express from 'express';
import { updateUser, getLeaderboard, getDebugResults } from '../controllers/userController.js';

const router = express.Router();

router.post('/', updateUser);
router.get('/leaderboard', getLeaderboard);
router.get('/debug/results', getDebugResults);

export default router;