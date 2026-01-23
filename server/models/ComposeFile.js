const mongoose = require('mongoose');

const ComposeFileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,  // YAML content
    required: true
  },

  containerName: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  deployedAt: {
    type: Date,
    default: null
  },
  lastError: {
    type: String,
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  validationWarnings: [{
    type: String
  }],
  templateName: {
    type: String,
    default: null
  }
}, { 
  timestamps: true 
});

// Extract container name from compose content before save
ComposeFileSchema.pre('save', async function() {
  if (this.isModified('content') && this.content) {
    try {
      const yaml = require('js-yaml');
      const parsed = yaml.load(this.content);
      
      // Get first service's container_name if available
      if (parsed && parsed.services) {
        const firstService = Object.keys(parsed.services)[0];
        if (firstService && parsed.services[firstService].container_name) {
          this.containerName = parsed.services[firstService].container_name;
        }
      }
    } catch (err) {
      // YAML parse error will be caught during validation
      console.error('Error parsing compose content for container name:', err.message);
    }
  }
});

// Increment version on content update
ComposeFileSchema.pre('save', async function() {
  if (this.isModified('content') && !this.isNew) {
    this.version += 1;
  }
});

module.exports = mongoose.model('ComposeFile', ComposeFileSchema);
