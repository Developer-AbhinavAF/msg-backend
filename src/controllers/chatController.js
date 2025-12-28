import Message from '../models/Message.js';
import ChatRoom from '../models/ChatRoom.js';
import { generateMessageId } from '../utils/auth.js';

export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { offset = 0, limit = 100 } = req.query;

    console.log(`📥 Fetching messages for room: ${roomId}, offset: ${offset}, limit: ${limit}`);

    // Verify room exists and user has access
    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      console.warn(`❌ Room not found: ${roomId}`);
      return res.status(404).json({ message: 'Room not found' });
    }

    // Fetch messages (sorted by timestamp ascending for chronological order)
    const messages = await Message.find({
      roomId,
      isDeletedForEveryone: { $ne: true },
    })
      .sort({ timestamp: 1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination info
    const totalCount = await Message.countDocuments({
      roomId,
      isDeletedForEveryone: { $ne: true },
    });

    console.log(`✓ Fetched ${messages.length} messages (total: ${totalCount})`);

    res.json({
      messages,
      total: totalCount,
      offset: parseInt(offset),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text', replyTo = null, senderName } = req.body;
    const userId = req.body.userId || req.user?.userId;

    console.log(`📤 Sending message in room: ${roomId}, type: ${type}`);

    if (!content) {
      return res.status(400).json({ message: 'Message content required' });
    }

    // Verify room exists
    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Handle reply to message - fetch original message details
    let replyData = replyTo;
    if (replyTo && replyTo.messageId) {
      const originalMessage = await Message.findOne({ messageId: replyTo.messageId }).lean();
      if (originalMessage) {
        replyData = {
          messageId: originalMessage.messageId,
          content: originalMessage.content,
          senderName: originalMessage.senderName || 'Unknown',
        };
      }
    }

    // Create message
    const message = new Message({
      messageId: generateMessageId(),
      roomId,
      senderId: userId,
      senderName: senderName || 'Unknown',
      content,
      type,
      replyTo: replyData,
      status: 'delivered',
      timestamp: new Date(),
    });

    await message.save();

    console.log(`✓ Message saved: ${message.messageId}`);

    res.status(201).json({
      message: message.toObject(),
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Send voice message
export const sendVoiceMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { audioBase64, duration } = req.body;
    const userId = req.body.userId || req.user?.userId;

    console.log(`🎤 Sending voice message in room: ${roomId}`);

    if (!audioBase64) {
      return res.status(400).json({ message: 'Audio data required' });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const message = new Message({
      messageId: generateMessageId(),
      roomId,
      senderId: userId,
      content: audioBase64,
      type: 'voice',
      duration: duration || 0,
      status: 'delivered',
      timestamp: new Date(),
    });

    await message.save();

    console.log(`✓ Voice message saved: ${message.messageId}`);

    res.status(201).json({
      message: message.toObject(),
    });
  } catch (error) {
    console.error('❌ Voice message error:', error);
    res.status(500).json({ message: 'Failed to send voice message' });
  }
};

// Create poll
export const createPoll = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { question, options } = req.body;
    const userId = req.body.userId || req.user?.userId;

    console.log(`📊 Creating poll in room: ${roomId}`);

    if (!question || !options || options.length < 2) {
      return res.status(400).json({ message: 'Poll must have question and at least 2 options' });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
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

    console.log(`✓ Poll created: ${poll.pollId}`);

    res.status(201).json({
      message: message.toObject(),
    });
  } catch (error) {
    console.error('❌ Poll creation error:', error);
    res.status(500).json({ message: 'Failed to create poll' });
  }
};

// Vote on poll
export const votePoll = async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const { optionIndex } = req.body;
    const userId = req.body.userId || req.user?.userId;

    console.log(`✅ Voting on poll in room: ${roomId}`);

    const message = await Message.findOne({ messageId, roomId });
    if (!message || message.type !== 'poll') {
      return res.status(404).json({ message: 'Poll not found' });
    }

    const poll = message.poll || JSON.parse(message.content);

    // Remove previous vote
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

    console.log(`✓ Vote recorded`);

    res.json({
      message: message.toObject(),
    });
  } catch (error) {
    console.error('❌ Poll vote error:', error);
    res.status(500).json({ message: 'Failed to vote on poll' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const userId = req.body.userId || req.user?.userId;

    const message = await Message.findOne({ messageId, roomId });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'Unauthorized to delete this message' });
    }

    message.isDeleted = true;
    await message.save();

    console.log(`✓ Message deleted: ${messageId}`);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

export const updateMessage = async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const { userId } = req.user;
    const { reactions } = req.body;

    const message = await Message.findOne({ messageId, roomId });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Update reactions
    if (reactions) {
      message.reactions = reactions;
      message.editedAt = new Date();
      await message.save();

      console.log(`✓ Message reactions updated`);
    }

    res.json({ message: message.toObject() });
  } catch (error) {
    console.error('❌ Update message error:', error);
    res.status(500).json({ message: 'Failed to update message' });
  }
};

export const getRoomData = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    console.log(`✓ Retrieved room data: ${roomId}`);

    res.json({
      roomId: room.roomId,
      users: room.users,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('❌ Get room data error:', error);
    res.status(500).json({ message: 'Failed to fetch room data' });
  }
};
