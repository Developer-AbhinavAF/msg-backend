import express from 'express';
import { loginUser, createRoom, logout } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/create-room', createRoom);
router.post('/logout', logout);

export default router;
