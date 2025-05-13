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
      default: '0 0 * * *'
    },
    retention: {
      type: Number,
      default: 5,
      min: 1,
      max: 30
    },
    lastBackup: {
      type: Date,
      required: false,
      default: null
    },
    lastError: {
      type: new mongoose.Schema({
        message: { type: String, default: null },
        date: { type: Date, default: null }
      }, { _id: false }),
      required: false,
      default: () => ({
        message: null,
        date: null
      })
    }
  },
  activeBackupJob: {
    inProgress: { 
      type: Boolean, 
      default: false 
    },
    startedAt: { 
      type: Date, 
      default: null 
    },
    status: { 
      type: String, 
      enum: ['pending', 'in_progress', 'completed', 'failed', null],
      default: null
    },
    message: { 
      type: String, 
      default: null 
    }
  },
  discordWebhook: {
    enabled: {
      type: Boolean,
      default: false
    },
    url: {
      type: String,
      default: ''
    },
    notifyOnStart: {
      type: Boolean,
      default: true
    },
    notifyOnStop: {
      type: Boolean,
      default: true
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