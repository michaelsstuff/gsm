const mongoose = require('mongoose');

const GameServerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  connectionString: {
    type: String,
    required: true,
    trim: true,
  },
  logo: {
    type: String,
    default: '/images/default-game-logo.png',
  },
  steamAppId: {
    type: String,
    trim: true,
  },
  websiteUrl: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  containerName: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  commands: {
    start: {
      type: String,
      default: 'start.sh',
    },
    stop: {
      type: String,
      default: 'stop.sh',
    },
    backup: {
      type: String,
      default: 'backup.sh',
    },
    restart: {
      type: String,
      default: 'restart.sh',
    },
  },
  status: {
    type: String,
    enum: ['running', 'stopped', 'error'],
    default: 'stopped',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the 'updatedAt' field on save
GameServerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GameServer', GameServerSchema);