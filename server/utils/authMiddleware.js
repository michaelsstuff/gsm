const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtSecret = process.env.JWT_SECRET || 'jwt_secret';

const resolveAuthenticatedUser = async (req) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return req.user;
  }

  const authHeader = req.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (!payload?.id) {
      return null;
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return null;
    }

    req.user = user;
    return user;
  } catch (error) {
    return null;
  }
};

const requireAuthenticated = async (req, res, next) => {
  const user = await resolveAuthenticatedUser(req);
  if (user) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
};

const requireAdmin = async (req, res, next) => {
  const user = await resolveAuthenticatedUser(req);
  if (user && user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

module.exports = {
  requireAuthenticated,
  requireAdmin
};
