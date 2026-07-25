import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  
  if (!token) {
    return next(new AppError('Access token required', 401, 'ACCESS_TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 403, 'INVALID_TOKEN'));
  }
};

export default authMiddleware;
