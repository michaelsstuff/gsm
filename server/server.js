const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const backupScheduler = require('./utils/backupScheduler');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const gameServerRoutes = require('./routes/gameServers');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

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
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Health check endpoint for container orchestration
app.get('/api/auth/status', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', gameServerRoutes);
app.use('/api/admin', adminRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

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