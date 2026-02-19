const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const backupScheduler = require('./utils/backupScheduler');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const gameServerRoutes = require('./routes/gameServers');
const adminRoutes = require('./routes/admin');
const composeRoutes = require('./routes/compose');
const templatesRoutes = require('./routes/templates');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'jwt_secret';
const apiWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

if (isProduction) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// File Upload middleware
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  },
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'gameserver-manager-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/gameserver-manager',
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    sameSite: 'lax',
    secure: true
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Provide a CSRF token per session and validate it for session-authenticated writes.
app.use((req, res, next) => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  next();
});

app.use('/api', apiWriteLimiter);

app.use('/api', (req, res, next) => {
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isWriteMethod) {
    return next();
  }

  // Allow bearer-token authenticated requests to proceed.
  const authHeader = req.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      jwt.verify(token, jwtSecret);
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid bearer token' });
    }
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }

  const csrfToken = req.get('x-csrf-token');
  if (!csrfToken || !req.session || csrfToken !== req.session.csrfToken) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }

  return next();
});

// Health check endpoint for container orchestration
app.get('/api/auth/status', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session?.csrfToken || null });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', gameServerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/compose', composeRoutes);
app.use('/api/admin/templates', templatesRoutes);

// Note: Frontend is served by a separate nginx container in Docker deployment
// Backend only handles API routes

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gameserver-manager')
  .then(() => {
    console.log('MongoDB connected');
    // Initialize backup scheduler after DB connection
    backupScheduler.initializeJobs().catch(err => {
      console.error('Failed to initialize backup scheduler:', err);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
