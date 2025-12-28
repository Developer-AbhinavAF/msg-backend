import { verifyToken } from '../utils/auth.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const validateRoomAccess = (req, res, next) => {
  const { roomId } = req.params;
  if (req.user.roomId !== roomId) {
    return res.status(403).json({ message: 'Access denied to this room' });
  }
  next();
};
