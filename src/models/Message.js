import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      unique: true,
      required: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    originalContent: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'voice', 'file', 'poll'],
      default: 'text',
    },
    duration: {
      type: Number, // For voice/audio messages (in seconds)
      default: 0,
    },
    poll: {
      type: {
        pollId: String,
        question: String,
        options: [
          {
            text: String,
            votes: [String], // Array of userIds who voted
          },
        ],
        createdBy: String,
        createdAt: Date,
      },
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    readBy: {
      type: [String], // Array of user IDs who read this message
      default: [],
    },
    reactions: [
      {
        emoji: String,
        users: [String], // Array of userIds who reacted
        count: { type: Number, default: 0 },
      },
    ],
    replyTo: {
      messageId: String,
      content: String,
      senderName: String,
    },
    deletedFor: {
      type: [String], // Array of userIds who deleted from their view
      default: [],
    },
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    editHistory: [
      {
        content: String,
        editedAt: Date,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
messageSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model('Message', messageSchema);
