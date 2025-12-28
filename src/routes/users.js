import express from 'express';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/:userId', authenticateToken, getProfile);
router.patch('/:userId', authenticateToken, updateProfile);

export default router;
