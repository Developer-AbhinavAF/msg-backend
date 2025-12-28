import mongoose from 'mongoose';
import User from './src/models/User.js';
import ChatRoom from './src/models/ChatRoom.js';

const setupTestData = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/private-chat';
    console.log('🔍 Connecting to:', uri);
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');

    // Create test users
    let user1 = await User.findOne({ userId: '1111' });
    if (!user1) {
      user1 = new User({
        userId: '1111',
        username: '1111',
        password: 'hashedpassword', // In real app this would be hashed
        isOnline: true,
      });
      await user1.save();
      console.log('✓ Created user 1111');
    } else {
      console.log('✓ User 1111 already exists');
    }

    let user2 = await User.findOne({ userId: '6910' });
    if (!user2) {
      user2 = new User({
        userId: '6910',
        username: '6910',
        password: 'hashedpassword',
        isOnline: true,
      });
      await user2.save();
      console.log('✓ Created user 6910');
    } else {
      console.log('✓ User 6910 already exists');
    }

    // Create test chat room
    let room = await ChatRoom.findOne({ roomId: 'chat_abhi_her' });
    if (!room) {
      room = new ChatRoom({
        roomId: 'chat_abhi_her',
        participants: ['1111', '6910'],
        createdAt: new Date(),
        lastMessage: null,
      });
      await room.save();
      console.log('✓ Created chat room chat_abhi_her');
    } else {
      console.log('✓ Chat room chat_abhi_her already exists');
    }

    console.log('\n✨ Test data setup complete!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

setupTestData();
