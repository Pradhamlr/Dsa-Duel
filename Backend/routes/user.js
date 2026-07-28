import express from 'express';
import { updateUser, getDebugResults, getSolvedProblems, clearSolvedProblems } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, updateUser);
router.get('/problems/solved', authMiddleware, getSolvedProblems);
router.delete('/problems/solved', authMiddleware, clearSolvedProblems);
router.get('/debug/results', authMiddleware, getDebugResults);

export default router;