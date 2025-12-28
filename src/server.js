import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import { verifyToken } from './utils/auth.js';
import Message from './models/Message.js';
import User from './models/User.js';
import { generateMessageId } from './utils/auth.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
console.log('📋 Environment loaded from:', path.resolve(__dirname, '../.env'));
console.log('🌍 MongoDB URI:', process.env.MONGODB_URI ? 'Set (Atlas)' : 'Not set (using localhost)');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Privacy headers - prevent history storage
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Connect to MongoDB
connectDB().catch((err) => {
  console.warn('⚠ MongoDB connection failed, continuing without database');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Track connected users per room
const connectedUsers = new Map(); // roomId -> {userId -> {socket, displayName}}
const userSockets = new Map(); // userId -> socket

console.log('🚀 Setting up WebSocket handlers...');

io.on('connection', (socket) => {
  console.log('✓ User connected:', socket.id);

  const { roomId, userId } = socket.handshake.query;

  if (!roomId || !userId) {
    console.warn('⚠ Missing roomId or userId in connection query');
    socket.disconnect();
    return;
  }

  console.log(`✓ Joining room: ${roomId}, User: ${userId}`);

  // Store socket reference
  userSockets.set(userId, socket);

  // Initialize room if not exists
  if (!connectedUsers.has(roomId)) {
    connectedUsers.set(roomId, new Map());
  }

  // Add user to room
  const room = connectedUsers.get(roomId);
  room.set(userId, {
    socket,
    userId,
  });

  // Join socket to room
  socket.join(roomId);

  console.log(`✓ Room members: ${room.size}`);

  // Broadcast online status for each user in room
  const onlineUsers = Array.from(room.keys());
  console.log(`📡 Broadcasting online status: ${onlineUsers.join(', ')}`);

  // Send online status for ALL users in the room
  onlineUsers.forEach((user) => {
    io.to(roomId).emit('user:online', {
      userId: user,
      isOnline: true,
    });
  });

  // Update user online status in database
  User.findOneAndUpdate(
    { userId },
    { isOnline: true, lastSeen: new Date() },
    { new: true }
  ).catch((err) => console.error('Failed to update user status:', err));

  // ============ MESSAGE HANDLERS ============

  // Send message
  socket.on('message:send', async (data) => {
    try {
      console.log(`📤 Message from ${userId}:`, data.content?.substring(0, 50));

      const { content, type = 'text', replyTo, senderName = '' } = data;

      if (!content || !content.toString().trim()) {
        console.warn('⚠ Empty message content');
        socket.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      const messageObj = new Message({
        messageId: generateMessageId(),
        roomId,
        senderId: userId,
        senderName: senderName || userId,
        content: content.toString().trim(),
        originalContent: content.toString().trim(),
        type,
        replyTo: replyTo || null,
        status: 'delivered',
        timestamp: new Date(),
      });

      const savedMessage = await messageObj.save();
      console.log(`✓ Message saved to DB: ${savedMessage.messageId}`);

      // Broadcast to ALL users in room
      console.log(`📡 Broadcasting message to ${roomId}...`);
      io.to(roomId).emit('message:received', {
        message: savedMessage.toObject(),
        status: 'delivered',
      });

      console.log(`✓ Message delivered to all users in room`);
    } catch (error) {
      console.error('❌ Message send error:', error.message);
      socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
  });

  // Send voice message
  socket.on('voice:send', async (data) => {
    try {
      console.log(`🎤 Voice message from ${userId}, duration: ${data.duration}s`);

      const { audioBase64, duration, senderName = '' } = data;

      if (!audioBase64) {
        socket.emit('error', { message: 'Audio data required' });
        return;
      }

      const message = new Message({
        messageId: generateMessageId(),
        roomId,
        senderId: userId,
        senderName: senderName || userId,
        content: audioBase64,
        type: 'voice',
        duration: duration || 0,
        status: 'delivered',
        timestamp: new Date(),
      });

      const savedMessage = await message.save();
      console.log(`✓ Voice message saved to DB: ${savedMessage.messageId}`);

      io.to(roomId).emit('message:received', {
        message: savedMessage.toObject(),
        status: 'delivered',
      });

      console.log(`✓ Voice message delivered`);
    } catch (error) {
      console.error('❌ Voice message error:', error.message);
      socket.emit('error', { message: 'Failed to send voice message' });
    }
  });

  // Send attachment/file
  socket.on('attachment:send', async (data) => {
    try {
      console.log(`📎 Attachment from ${userId}: ${data.filename}`);

      const { filename, fileBase64, fileType, fileSize, senderName = '' } = data;

      if (!fileBase64 || !filename) {
        socket.emit('error', { message: 'File data and filename required' });
        return;
      }

      // Determine message type based on file type
      let messageType = 'file';
      if (fileType?.startsWith('image/')) {
        messageType = 'image';
      } else if (fileType?.startsWith('video/')) {
        messageType = 'video';
      } else if (fileType?.startsWith('audio/')) {
        messageType = 'audio';
      }

      const message = new Message({
        messageId: generateMessageId(),
        roomId,
        senderId: userId,
        senderName: senderName || userId,
        content: fileBase64,
        type: messageType,
        mediaUrl: filename,
        status: 'delivered',
        timestamp: new Date(),
      });

      const savedMessage = await message.save();
      console.log(`✓ Attachment saved to DB: ${savedMessage.messageId}`)

      io.to(roomId).emit('message:received', {
        message: savedMessage.toObject(),
        filename,
        fileType,
        fileSize,
        status: 'delivered',
      });

      console.log(`✓ Attachment delivered`);
    } catch (error) {
      console.error('❌ Attachment error:', error.message);
      socket.emit('error', { message: 'Failed to send attachment' });
    }
  });

  // Create poll
  socket.on('poll:create', async (data) => {
    try {
      console.log(`📊 Poll created by ${userId}:`, data.question);

      const { question, options } = data;

      if (!question || !options || options.length < 2) {
        socket.emit('error', { message: 'Poll must have question and at least 2 options' });
        return;
      }

      const poll = {
        pollId: generateMessageId(),
        question,
        options: options.map((opt) => ({
          text: opt,
          votes: [],
        })),
        createdBy: userId,
        createdAt: new Date(),
      };

      const message = new Message({
        messageId: generateMessageId(),
        roomId,
        senderId: userId,
        content: JSON.stringify(poll),
        type: 'poll',
        poll,
        status: 'delivered',
        timestamp: new Date(),
      });

      await message.save();
      console.log(`✓ Poll saved: ${poll.pollId}`);

      io.to(roomId).emit('message:received', {
        message: message.toObject(),
      });

      console.log(`✓ Poll broadcast to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Poll creation error:', error);
      socket.emit('error', { message: 'Failed to create poll' });
    }
  });

  // Vote on poll
  socket.on('poll:vote', async (data) => {
    try {
      console.log(`✅ Vote from ${userId} on poll: ${data.messageId}`);

      const { messageId, optionIndex } = data;

      const message = await Message.findOne({ messageId, roomId });
      if (!message || message.type !== 'poll') {
        socket.emit('error', { message: 'Poll not found' });
        return;
      }

      const poll = message.poll || JSON.parse(message.content);

      // Remove previous vote from user
      poll.options.forEach((opt) => {
        opt.votes = opt.votes.filter((v) => v !== userId);
      });

      // Add new vote
      if (poll.options[optionIndex]) {
        poll.options[optionIndex].votes.push(userId);
      }

      message.poll = poll;
      message.content = JSON.stringify(poll);
      await message.save();

      io.to(roomId).emit('poll:updated', {
        messageId,
        poll,
      });

      console.log(`✓ Vote recorded and broadcast`);
    } catch (error) {
      console.error('❌ Poll vote error:', error);
      socket.emit('error', { message: 'Failed to vote on poll' });
    }
  });

  // ============ TYPING INDICATOR ============

  socket.on('typing:update', (data) => {
    console.log(`⌨️ ${userId} typing: ${data.isTyping}`);
    socket.to(roomId).emit('typing:update', {
      userId,
      isTyping: data.isTyping,
    });
  });

  // ============ REACTIONS ============

  socket.on('reaction:add', async (data) => {
    try {
      console.log(`😊 Reaction from ${userId}:`, data.emoji);

      const { messageId, emoji } = data;

      const message = await Message.findOne({ messageId, roomId });
      if (!message) {
        console.warn(`⚠ Message not found: ${messageId}`);
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (!message.reactions) {
        message.reactions = [];
      }

      const existingReaction = message.reactions.find(
        (r) => r.emoji === emoji && r.users.includes(userId)
      );

      if (existingReaction) {
        // Remove reaction
        existingReaction.users = existingReaction.users.filter((u) => u !== userId);
        existingReaction.count = existingReaction.users.length;
        if (existingReaction.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
        console.log(`😊 Reaction removed by ${userId}`)
      } else {
        // Add reaction
        const reaction = message.reactions.find((r) => r.emoji === emoji);
        if (reaction) {
          reaction.users.push(userId);
          reaction.count = reaction.users.length;
        } else {
          message.reactions.push({
            emoji,
            users: [userId],
            count: 1,
          });
        }
        console.log(`😊 Reaction added by ${userId}`);
      }

      const updatedMessage = await message.save();
      console.log(`✓ Reaction saved to DB`);

      io.to(roomId).emit('reaction:updated', {
        messageId,
        reactions: updatedMessage.reactions,
        emoji,
        userId,
      });

      console.log(`✓ Reaction broadcast to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Reaction error:', error.message);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  // ============ READ RECEIPTS ============

  socket.on('message:read', async (data) => {
    try {
      console.log(`✓ Messages read by ${userId}`);

      const { messageIds } = data;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        console.warn('⚠ Invalid messageIds array');
        return;
      }

      // Update messages in database
      const result = await Message.updateMany(
        { messageId: { $in: messageIds }, roomId, senderId: { $ne: userId } },
        { 
          status: 'read', 
          $addToSet: { readBy: userId }
        }
      );

      console.log(`✓ Updated ${result.modifiedCount} messages as read`);

      // Broadcast to all users in room
      io.to(roomId).emit('message:read', {
        userId,
        messageIds,
      });

      console.log(`✓ Read receipts broadcast to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Read receipt error:', error.message);
    }
  });

  // ============ MESSAGE EDIT ============

  socket.on('message:edit', async (data) => {
    try {
      console.log(`✏️ Message edit from ${userId}: ${data.messageId}`);

      const { messageId, newContent } = data;

      if (!newContent || !newContent.toString().trim()) {
        socket.emit('error', { message: 'New content cannot be empty' });
        return;
      }

      const message = await Message.findOne({ messageId, roomId });
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.senderId !== userId) {
        socket.emit('error', { message: 'You can only edit your own messages' });
        return;
      }

      // NO TIME LIMIT - Allow editing anytime
      // Store edit history
      if (!message.editHistory) {
        message.editHistory = [];
      }
      message.editHistory.push({
        content: message.content,
        editedAt: new Date(),
      });

      message.content = newContent.toString().trim();
      message.isEdited = true;
      message.editedAt = new Date();

      const updatedMessage = await message.save();
      console.log(`✓ Message edited and saved`);

      io.to(roomId).emit('message:edited', {
        messageId,
        content: updatedMessage.content,
        isEdited: true,
        editedAt: updatedMessage.editedAt,
      });

      console.log(`✓ Edit broadcast to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Message edit error:', error.message);
      socket.emit('error', { message: 'Failed to edit message: ' + error.message });
    }
  });

  // ============ MESSAGE DELETE ============

  socket.on('message:delete', async (data) => {
    try {
      console.log(`🗑️ Message delete from ${userId}: ${data.messageId}`);

      const { messageId, deleteForEveryone = false } = data;

      const message = await Message.findOne({ messageId, roomId });
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.senderId !== userId) {
        socket.emit('error', { message: 'You can only delete your own messages' });
        return;
      }

      if (deleteForEveryone) {
        // Delete for everyone
        message.isDeletedForEveryone = true;
        message.content = '[This message was deleted]';
        message.originalContent = null;
      } else {
        // Delete only for this user
        if (!message.deletedFor) {
          message.deletedFor = [];
        }
        if (!message.deletedFor.includes(userId)) {
          message.deletedFor.push(userId);
        }
      }

      const updatedMessage = await message.save();
      console.log(`✓ Message deleted`);

      io.to(roomId).emit('message:deleted', {
        messageId,
        deletedFor: deleteForEveryone ? 'everyone' : userId,
        message: deleteForEveryone ? updatedMessage.toObject() : null,
      });

      console.log(`✓ Delete broadcast to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Message delete error:', error.message);
      socket.emit('error', { message: 'Failed to delete message: ' + error.message });
    }
  });

  // ============ DISCONNECT ============

  socket.on('disconnect', async () => {
    console.log(`❌ User disconnected: ${userId}`);

    // Remove from connected users
    const room = connectedUsers.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        connectedUsers.delete(roomId);
      }
    }

    userSockets.delete(userId);

    // Update user offline status
    try {
      await User.findOneAndUpdate(
        { userId },
        { isOnline: false, lastSeen: new Date() }
      );
    } catch (err) {
      console.error('Failed to update user offline status:', err);
    }

    // Broadcast offline status
    const remainingUsers = room ? Array.from(room.keys()) : [];
    console.log(`📡 Broadcasting offline status. Remaining users: ${remainingUsers.join(', ')}`);

    io.to(roomId).emit('user:offline', {
      userId,
      isOnline: false,
    });
  });

  // ============ ERROR HANDLING ============

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${userId}:`, error);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket enabled for real-time messaging`);
  console.log(`✨ Features: Messages, Voice, Polls, Reactions, Read Receipts\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⏹️  SIGTERM signal received');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default io;
