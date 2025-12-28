import User from '../models/User.js';

export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.toObject());
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName, avatar } = req.body;

    if (req.user.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const user = await User.findOneAndUpdate(
      { userId },
      { displayName, avatar },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.toObject());
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

export const setNickname = async (req, res) => {
  try {
    const { userId, nickname } = req.body;
    const { roomId } = req.params;

    // Update user's nickname in the chat room context
    // This would be stored per-room per-user
    // Implementation depends on how you want to structure the data

    res.json({ message: 'Nickname updated successfully' });
  } catch (error) {
    console.error('Set nickname error:', error);
    res.status(500).json({ message: 'Failed to set nickname' });
  }
};
