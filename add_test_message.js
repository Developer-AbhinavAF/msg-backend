import mongoose from 'mongoose';
import Message from './src/models/Message.js';

const addTestMessage = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/private-chat';
    console.log('🔍 Connecting to:', uri);
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');

    // Add a test message
    const testMessage = new Message({
      messageId: 'test-msg-' + Date.now(),
      roomId: 'chat_abhi_her',
      senderId: '1111',
      senderName: 'Abhinav 🎀',
      content: 'This is a test message',
      type: 'text',
      status: 'delivered',
      timestamp: new Date(),
    });

    const saved = await testMessage.save();
    console.log('✓ Message saved:', saved.messageId);

    // Now query it back
    const messages = await Message.find({ roomId: 'chat_abhi_her' }).lean();
    console.log('✓ Found', messages.length, 'messages in room');
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. From: ${msg.senderName}, Content: ${msg.content}`);
    });

    await mongoose.disconnect();
    console.log('✓ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

addTestMessage();
