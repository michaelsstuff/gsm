const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
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
const rateLimitStore = new Map();
const sessionCookieSecure =
  process.env.SESSION_COOKIE_SECURE === 'true'
    ? true
    : process.env.SESSION_COOKIE_SECURE === 'false'
      ? false
      : 'auto';

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

const createRateLimiter = ({ windowMs, maxRequests, keyPrefix }) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateLimitStore.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    existing.count += 1;
    return next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000).unref();

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
    secure: sessionCookieSecure
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
app.use('/api/auth', createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 120, keyPrefix: 'auth' }), authRoutes);
app.use('/api/servers', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 180, keyPrefix: 'servers' }), gameServerRoutes);
app.use('/api/admin', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120, keyPrefix: 'admin' }), adminRoutes);
app.use('/api/admin/compose', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 60, keyPrefix: 'compose' }), composeRoutes);
app.use('/api/admin/templates', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120, keyPrefix: 'templates' }), templatesRoutes);

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
