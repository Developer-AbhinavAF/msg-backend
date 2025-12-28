import express from 'express';
import {
  getMessages,
  sendMessage,
  sendVoiceMessage,
  createPoll,
  votePoll,
  deleteMessage,
  updateMessage,
  getRoomData,
} from '../controllers/chatController.js';
import { authenticateToken, validateRoomAccess } from '../middleware/auth.js';

const router = express.Router();

// Room data
router.get('/:roomId', authenticateToken, validateRoomAccess, getRoomData);

// Messages
router.get('/:roomId/messages', authenticateToken, validateRoomAccess, getMessages);
router.post('/:roomId/messages', authenticateToken, validateRoomAccess, sendMessage);
router.delete('/:roomId/messages/:messageId', authenticateToken, validateRoomAccess, deleteMessage);
router.patch('/:roomId/messages/:messageId', authenticateToken, validateRoomAccess, updateMessage);

// Voice messages
router.post('/:roomId/voice', authenticateToken, validateRoomAccess, sendVoiceMessage);

// Polls
router.post('/:roomId/polls', authenticateToken, validateRoomAccess, createPoll);
router.post('/:roomId/polls/:messageId/vote', authenticateToken, validateRoomAccess, votePoll);

export default router;
