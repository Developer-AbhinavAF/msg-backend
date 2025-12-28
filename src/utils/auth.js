import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId, roomId) => {
  return jwt.sign({ userId, roomId }, process.env.JWT_SECRET || 'secret_key', {
    expiresIn: '7d',
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const generateRoomId = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
};

export const generateMessageId = () => {
  return crypto.randomUUID();
};

export const generateUserId = () => {
  return crypto.randomUUID();
};
