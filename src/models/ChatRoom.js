import mongoose from 'mongoose';

const chatRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      unique: true,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    users: [
      {
        userId: String,
        displayName: String,
        nickname: String, // Custom name set by other user
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    autoDeleteAfter: {
      type: Number, // hours (0 = never, 24 = 24h, 168 = 7d)
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Enforce max 2 users
chatRoomSchema.pre('save', async function (next) {
  if (this.users.length > 2) {
    throw new Error('Room can only have maximum 2 users');
  }
  next();
});

export default mongoose.model('ChatRoom', chatRoomSchema);
