const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
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
router.post('/login', (req, res, next) => {
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
        token
      });
    });
  })(req, res, next);
});

// @route   GET /api/auth/logout
// @desc    Logout user
// @access  Private
router.get('/logout', isAuthenticated, (req, res) => {
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
router.get('/current', isAuthenticated, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;