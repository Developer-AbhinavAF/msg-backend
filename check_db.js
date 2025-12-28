import mongoose from 'mongoose';
import Message from './src/models/Message.js';

const checkDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/private-chat';
    console.log('🔍 Connecting to:', uri);
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');

    // Get all messages
    const allMessages = await Message.find({}).lean();
    console.log('\n📊 Total messages in DB:', allMessages.length);

    if (allMessages.length > 0) {
      console.log('\n📋 Sample messages:');
      allMessages.slice(0, 5).forEach((msg, i) => {
        console.log(`${i + 1}. Room: ${msg.roomId}, From: ${msg.senderName}, Content: ${msg.content?.substring(0, 50)}`);
      });
    }

    // Check the specific room
    const targetRoomMessages = await Message.find({ roomId: 'chat_abhi_her' }).lean();
    console.log(`\n🎯 Messages in chat_abhi_her: ${targetRoomMessages.length}`);

    if (targetRoomMessages.length > 0) {
      console.log('\n📝 First message from that room:');
      const msg = targetRoomMessages[0];
      console.log(`   From: ${msg.senderName}`);
      console.log(`   Content: ${msg.content}`);
      console.log(`   Timestamp: ${msg.timestamp}`);
    }

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkDB();
