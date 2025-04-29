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
    default: '',
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
  status: {
    type: String,
    enum: ['running', 'stopped', 'error'],
    default: 'stopped',
  },
  backupSchedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    cronExpression: {
      type: String,
      default: '0 0 * * *' // Daily at midnight
    },
    retention: {
      type: Number,
      default: 5, // Keep last 5 backups by default
      min: 1,
      max: 30
    },
    lastBackup: {
      type: Date
    },
    lastError: {
      message: String,
      date: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Update the 'updatedAt' field on save
GameServerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GameServer', GameServerSchema);