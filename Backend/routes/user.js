import express from 'express';
import { updateUser, getDebugResults } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, updateUser);
router.get('/debug/results', authMiddleware, getDebugResults);

export default router;