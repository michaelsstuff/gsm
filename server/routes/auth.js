const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const passwordSecurity = require('../utils/passwordSecurity');
const { requireAuthenticated } = require('../utils/authMiddleware');
const gsmVersion = process.env.GSM_VERSION || process.env.TGSM_VERSION || 'dev';

const normalizeInputString = (value) => (typeof value === 'string' ? value.trim() : '');
const authRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const isValidEmail = (email) => {
  if (typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim();
  if (!normalized || normalized.length > 254) {
    return false;
  }

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@') || atIndex === normalized.length - 1) {
    return false;
  }

  if (/\s/.test(normalized)) {
    return false;
  }

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);

  if (localPart.length > 64 || domainPart.length > 253) {
    return false;
  }

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  if (!domainPart.includes('.') || domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false;
  }

  return domainPart.split('.').every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      /^[A-Za-z0-9-]+$/.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
    );
  });
};

router.use(authRouteLimiter);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', credentialLimiter, async (req, res) => {
  try {
    const username = normalizeInputString(req.body.username);
    const email = normalizeInputString(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: { $eq: email } },
        { username: { $eq: username } }
      ]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Check password against HaveIBeenPwned database
    const passwordCheck = await passwordSecurity.checkPassword(password);
    
    if (passwordCheck.isPwned && passwordSecurity.shouldBlockPassword(passwordCheck.count)) {
      return res.status(400).json({ 
        message: 'This password has been compromised in data breaches and cannot be used',
        details: passwordSecurity.getSecurityMessage(passwordCheck.count),
        securityWarning: true
      });
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      password,
      // First registered user is admin
      role: (await User.countDocuments({})) === 0 ? 'admin' : 'user'
    });
    
    await user.save();
    
    // Authenticate user after registration
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in after registration' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'jwt_secret',
        { expiresIn: '1d' }
      );
      
      return res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        gsmVersion,
        token
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', credentialLimiter, (req, res, next) => {
  const username = normalizeInputString(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  req.body.username = username;
  req.body.password = password;

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Authentication error' });
    }
    
    if (!user) {
      return res.status(400).json({ message: info.message || 'Invalid credentials' });
    }
    
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login error' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'jwt_secret',
        { expiresIn: '1d' }
      );
      
      return res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        gsmVersion,
        token
      });
    });
  })(req, res, next);
});

// @route   GET /api/auth/logout
// @desc    Logout user
// @access  Private
router.get('/logout', requireAuthenticated, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout error' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// @route   GET /api/auth/current
// @desc    Get current user
// @access  Private
router.get('/current', requireAuthenticated, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    },
    gsmVersion
  });
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (email and password)
// @access  Private
router.put('/profile', requireAuthenticated, async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const userId = req.user._id;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    const validatedUserId = new mongoose.Types.ObjectId(userId);

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Check new password against HaveIBeenPwned database
      const passwordCheck = await passwordSecurity.checkPassword(newPassword);
      
      if (passwordCheck.isPwned && passwordSecurity.shouldBlockPassword(passwordCheck.count)) {
        return res.status(400).json({ 
          message: 'This password has been compromised in data breaches and cannot be used',
          details: passwordSecurity.getSecurityMessage(passwordCheck.count),
          securityWarning: true
        });
      }

      user.password = newPassword;
    }

    // Update email if provided
    if (normalizedEmail && normalizedEmail !== user.email) {
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: { $eq: normalizedEmail },
        _id: { $ne: validatedUserId }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
      }
      user.email = normalizedEmail;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// @route   POST /api/auth/check-password
// @desc    Check password against HaveIBeenPwned database
// @access  Public (for real-time checking during registration/password change)
router.post('/check-password', credentialLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    const passwordCheck = await passwordSecurity.checkPassword(password);
    
    res.json({
      isPwned: passwordCheck.isPwned,
      count: passwordCheck.count,
      message: passwordSecurity.getSecurityMessage(passwordCheck.count),
      shouldBlock: passwordSecurity.shouldBlockPassword(passwordCheck.count),
      error: passwordCheck.error || null
    });
  } catch (error) {
    console.error('Password check error:', error);
    res.status(500).json({ 
      message: 'Error checking password security',
      error: 'Password security service temporarily unavailable'
    });
  }
});

module.exports = router;
