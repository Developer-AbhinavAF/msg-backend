import ChatRoom from '../models/ChatRoom.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { hashPassword, comparePassword, generateToken, generateUserId, generateMessageId } from '../utils/auth.js';

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(`Login attempt: username=${username}`);

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Hardcoded user credentials
    const USERS = {
      '1111': { password: 'Abhi6910', displayName: 'Abhinav 🎀', userId: '1111', senderName: 'Abhinav 🎀' },
      '6910': { password: 'Adiuiscute', displayName: 'Adiuu Ji 💗🎀', userId: '6910', senderName: 'Adiuu Ji 💗🎀' },
    };

    // Verify credentials
    const user_cred = USERS[username];
    if (!user_cred) {
      console.log(`User not found: ${username}`);
      return res.status(404).json({ message: 'User not found. Use username: 1111 or 6910' });
    }

    if (password !== user_cred.password) {
      console.log(`Invalid password for user: ${username}`);
      return res.status(401).json({ message: 'Invalid password' });
    }

    console.log(`Credentials valid for: ${user_cred.displayName}`);

    // Ensure chat room exists (shared room for both users)
    const CHAT_ROOM_ID = 'chat_abhi_her';
    let room = await ChatRoom.findOne({ roomId: CHAT_ROOM_ID });
    if (!room) {
      console.log(`Creating new chat room: ${CHAT_ROOM_ID}`);
      room = new ChatRoom({
        roomId: CHAT_ROOM_ID,
        passwordHash: 'shared_room',
        users: [],
        isActive: true,
      });
      await room.save();
      console.log(`Chat room created successfully`);
    } else {
      console.log(`Chat room already exists`);
    }

    // Find or create user
    let user = await User.findOne({ userId: user_cred.userId });
    if (!user) {
      console.log(`Creating new user: ${user_cred.userId}`);
      user = new User({
        userId: user_cred.userId,
        displayName: user_cred.displayName,
        isOnline: true,
        lastSeen: new Date(),
      });
      await user.save();
      console.log(`User created successfully`);
    } else {
      console.log(`User already exists, updating status`);
      // Update online status
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
    }

    // Add user to room if not already
    const userInRoom = room.users.find((u) => u.userId === user.userId);
    if (!userInRoom && room.users.length < 2) {
      console.log(`Adding user to room`);
      room.users.push({
        userId: user.userId,
        displayName: user.displayName,
        joinedAt: new Date(),
      });
      await room.save();
      console.log(`User added to room`);
    }

    // Generate token
    const token = generateToken(user.userId, CHAT_ROOM_ID);

    console.log(`Login successful for: ${user_cred.displayName}`);

    res.json({
      token,
      user: {
        userId: user.userId,
        displayName: user.displayName,
        senderName: user_cred.senderName,
        isOnline: true,
      },
      room: {
        roomId: CHAT_ROOM_ID,
        users: room.users,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const createRoom = async (req, res) => {
  try {
    const { roomId, password } = req.body;

    if (!roomId || !password) {
      return res.status(400).json({ message: 'Room ID and password required' });
    }

    // Check if room already exists
    const existingRoom = await ChatRoom.findOne({ roomId });
    if (existingRoom) {
      return res.status(409).json({ message: 'Room already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create room
    const newRoom = new ChatRoom({
      roomId,
      passwordHash,
      users: [],
    });

    await newRoom.save();

    res.status(201).json({
      message: 'Room created successfully',
      room: newRoom,
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Failed to create room' });
  }
};

export const logout = (req, res) => {
  // Token is invalidated on client side
  res.json({ message: 'Logged out successfully' });
};
