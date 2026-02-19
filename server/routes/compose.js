const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ComposeFile = require('../models/ComposeFile');
const GameServer = require('../models/GameServer');
const composeValidator = require('../utils/composeValidator');
const composeService = require('../utils/composeService');
const dockerService = require('../utils/dockerService');
const { requireAdmin } = require('../utils/authMiddleware');

const composeRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(composeRouteLimiter);

// @route   GET /api/admin/compose
// @desc    Get all compose files
// @access  Admin only
router.get('/', requireAdmin, async (req, res) => {
  try {
    const composeFiles = await ComposeFile.find()
      .sort({ updatedAt: -1 });
    res.json(composeFiles);
  } catch (error) {
    console.error('Error fetching compose files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/compose/:id
// @desc    Get a single compose file
// @access  Admin only
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const composeFile = await ComposeFile.findById(req.params.id);
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    res.json(composeFile);
  } catch (error) {
    console.error('Error fetching compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/compose
// @desc    Create a new compose file
// @access  Admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, content, templateName } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ message: 'Name and content are required' });
    }
    
    // Get existing container names for uniqueness check
    const existingServers = await GameServer.find({}, 'containerName');
    const existingComposeFiles = await ComposeFile.find({}, 'containerName');
    const existingNames = [
      ...existingServers.map(s => s.containerName),
      ...existingComposeFiles.map(c => c.containerName).filter(Boolean)
    ];
    
    // Validate compose file
    const validation = await composeValidator.validateComposeFile(content, existingNames);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Compose file validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // Create compose file
    const composeFile = new ComposeFile({
      name,
      content,
      templateName: templateName || null,
      containerName: validation.containerName,
      validationWarnings: validation.warnings
    });
    
    await composeFile.save();
    
    res.status(201).json({
      message: 'Compose file created successfully',
      composeFile,
      warnings: validation.warnings
    });
  } catch (error) {
    console.error('Error creating compose file:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Container name already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/compose/:id
// @desc    Update a compose file
// @access  Admin only
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, content } = req.body;
    
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    // Can't update deployed compose files directly (must undeploy first or use redeploy)
    if (composeFile.status === 'deployed') {
      return res.status(400).json({ 
        message: 'Cannot update deployed compose file. Undeploy first or use the redeploy endpoint.' 
      });
    }
    
    // Validate if content changed
    if (content && content !== composeFile.content) {
      const existingServers = await GameServer.find({ 
        containerName: { $ne: composeFile.containerName } 
      }, 'containerName');
      const existingComposeFiles = await ComposeFile.find({ 
        _id: { $ne: composeFile._id },
        containerName: { $ne: null }
      }, 'containerName');
      const existingNames = [
        ...existingServers.map(s => s.containerName),
        ...existingComposeFiles.map(c => c.containerName)
      ];
      
      const validation = await composeValidator.validateComposeFile(content, existingNames);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          message: 'Compose file validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
      
      composeFile.content = content;
      composeFile.containerName = validation.containerName;
      composeFile.validationWarnings = validation.warnings;
    }
    
    if (name) {
      composeFile.name = name;
    }
    
    await composeFile.save();
    
    res.json({
      message: 'Compose file updated successfully',
      composeFile
    });
  } catch (error) {
    console.error('Error updating compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Container name already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/compose/:id
// @desc    Delete a compose file
// @access  Admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    // Delete from database
    await ComposeFile.findByIdAndDelete(req.params.id);
    res.json({ message: 'Compose file deleted successfully' });
  } catch (error) {
    console.error('Error deleting compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/compose/:id/validate
// @desc    Validate a compose file
// @access  Admin only
router.post('/:id/validate', requireAdmin, async (req, res) => {
  try {
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    // Get existing container names, excluding this one
    const existingServers = await GameServer.find({ 
      containerName: { $ne: composeFile.containerName } 
    }, 'containerName');
    const existingComposeFiles = await ComposeFile.find({ 
      _id: { $ne: composeFile._id },
      containerName: { $ne: null }
    }, 'containerName');
    const existingNames = [
      ...existingServers.map(s => s.containerName),
      ...existingComposeFiles.map(c => c.containerName)
    ];
    
    const validation = await composeValidator.validateComposeFile(
      composeFile.content, 
      existingNames
    );
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      containerName: validation.containerName
    });
  } catch (error) {
    console.error('Error validating compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/compose/:id/deploy
// @desc    Deploy a compose file (docker compose up -d)
// @access  Admin only
router.post('/:id/deploy', requireAdmin, async (req, res) => {
  try {
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    

    
    if (!composeFile.containerName) {
      return res.status(400).json({ message: 'Compose file has no container name defined' });
    }
    

    
    // Deploy
    const result = await composeService.deploy(
      composeFile._id.toString(),
      composeFile.content,
      composeFile.containerName
    );
    

    if (!result.success) {
      composeFile.lastError = result.error;
      await composeFile.save();
      return res.status(500).json({
        message: 'Deployment failed',
        error: result.error,
        output: result.output
      });
    }
    
    // Wait a moment for container to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if container is running
    const containerStatus = await dockerService.getContainerStatus(composeFile.containerName);
    
    // Create or update GameServer entry (no link to ComposeFile)
    let gameServer = await GameServer.findOne({ containerName: composeFile.containerName });

    // Lookup Steam info by composeFile name and map to GameServer fields
    let steamInfo = null;
    let steamFields = {};
    try {
      const { searchSteamGame, mapSteamInfoToGameServerFields } = require('../utils/steamLookup');
      steamInfo = await searchSteamGame(composeFile.name);
      steamFields = mapSteamInfoToGameServerFields(steamInfo, composeFile.name);
    } catch (e) {
      // Ignore steam lookup errors
    }

    if (!gameServer) {
      gameServer = new GameServer({
        name: steamFields.name || composeFile.name,
        containerName: composeFile.containerName,
        connectionString: 'Configure connection string',
        status: containerStatus,
        isManaged: true,
        steamAppId: steamFields.steamAppId || '',
        logo: steamFields.logo || '',
        websiteUrl: steamFields.websiteUrl || '',
        description: steamFields.description || ''
      });
      await gameServer.save();
    } else {
      gameServer.status = containerStatus;
      gameServer.isManaged = true;
      if (steamFields.steamAppId) gameServer.steamAppId = steamFields.steamAppId;
      if (steamFields.logo) gameServer.logo = steamFields.logo;
      if (steamFields.websiteUrl) gameServer.websiteUrl = steamFields.websiteUrl;
      if (steamFields.description) gameServer.description = steamFields.description;
      if (steamFields.name) gameServer.name = steamFields.name;
      await gameServer.save();
    }


    // Update compose file (no gameServer field, no status)
    composeFile.deployedAt = new Date();
    await composeFile.save();

    res.json({
      message: 'Deployment successful',
      composeFile,
      gameServer,
      output: result.output
    });
  } catch (error) {
    console.error('Error deploying compose file:', error);
    
    // Try to update status on error
    try {
      await ComposeFile.findByIdAndUpdate(req.params.id, {
        status: 'error',
        lastError: error.message
      });
    } catch {}
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/admin/compose/:id/undeploy
// @desc    Undeploy a compose file (docker compose down)
// @access  Admin only
router.post('/:id/undeploy', requireAdmin, async (req, res) => {
  try {
    const { removeVolumes } = req.body;
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    

    
    // Undeploy
    const result = await composeService.undeploy(
      composeFile._id.toString(),
      composeFile.containerName,
      removeVolumes === true
    );
    
    if (!result.success) {
      return res.status(500).json({
        message: 'Undeploy failed',
        error: result.error,
        output: result.output
      });
    }
    
    // Update GameServer status if it exists
    if (composeFile.gameServer) {
      await GameServer.findByIdAndUpdate(composeFile.gameServer, {
        status: 'stopped'
      });
    }
    
    // Update compose file
    composeFile.status = 'stopped';
    composeFile.lastError = null;
    await composeFile.save();
    
    res.json({
      message: 'Undeploy successful',
      composeFile,
      output: result.output
    });
  } catch (error) {
    console.error('Error undeploying compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/admin/compose/:id/redeploy
// @desc    Update and redeploy a compose file
// @access  Admin only
router.post('/:id/redeploy', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    // Validate new content if provided
    if (content) {
      const existingServers = await GameServer.find({ 
        containerName: { $ne: composeFile.containerName } 
      }, 'containerName');
      const existingComposeFiles = await ComposeFile.find({ 
        _id: { $ne: composeFile._id },
        containerName: { $ne: null }
      }, 'containerName');
      const existingNames = [
        ...existingServers.map(s => s.containerName),
        ...existingComposeFiles.map(c => c.containerName)
      ];
      
      const validation = await composeValidator.validateComposeFile(content, existingNames);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          message: 'Compose file validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
      
      // Check if container name changed
      if (validation.containerName !== composeFile.containerName) {
        return res.status(400).json({
          message: 'Cannot change container name during redeploy. Undeploy first.'
        });
      }
      
      composeFile.content = content;
      composeFile.validationWarnings = validation.warnings;
    }
    
    // Deploy with updated content
    const result = await composeService.deploy(
      composeFile._id.toString(),
      composeFile.content,
      composeFile.containerName
    );
    
    if (!result.success) {
      composeFile.lastError = result.error;
      await composeFile.save();
      
      return res.status(500).json({
        message: 'Redeploy failed',
        error: result.error,
        output: result.output
      });
    }
    
    // Wait for container to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update status
    const containerStatus = await dockerService.getContainerStatus(composeFile.containerName);
    
    composeFile.status = 'deployed';
    composeFile.deployedAt = new Date();
    composeFile.lastError = null;
    await composeFile.save();
    
    // Update GameServer status
    if (composeFile.gameServer) {
      await GameServer.findByIdAndUpdate(composeFile.gameServer, {
        status: containerStatus
      });
    }
    
    res.json({
      message: 'Redeploy successful',
      composeFile,
      output: result.output
    });
  } catch (error) {
    console.error('Error redeploying compose file:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/admin/compose/:id/logs
// @desc    Get logs from a deployed compose container
// @access  Admin only
router.get('/:id/logs', requireAdmin, async (req, res) => {
  try {
    const { lines = 100 } = req.query;
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    if (!composeFile.containerName) {
      return res.status(400).json({ message: 'Compose file has no container name' });
    }
    
    const result = await composeService.getLogs(
      composeFile.containerName,
      parseInt(lines, 10)
    );
    
    if (!result.success) {
      return res.status(500).json({
        message: 'Failed to get logs',
        error: result.error
      });
    }
    
    res.json({
      logs: result.output
    });
  } catch (error) {
    console.error('Error getting compose logs:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/compose/:id/pull
// @desc    Pull latest images for a compose file
// @access  Admin only
router.post('/:id/pull', requireAdmin, async (req, res) => {
  try {
    const composeFile = await ComposeFile.findById(req.params.id);
    
    if (!composeFile) {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    if (!composeFile.containerName) {
      return res.status(400).json({ message: 'Compose file has no container name' });
    }
    

    
    const result = await composeService.pullImages(
      composeFile._id.toString(),
      composeFile.containerName,
      composeFile.content
    );
    
    if (!result.success) {
      return res.status(500).json({
        message: 'Failed to pull images',
        error: result.error,
        output: result.output
      });
    }
    
    res.json({
      message: 'Images pulled successfully',
      output: result.output
    });
  } catch (error) {
    console.error('Error pulling compose images:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Compose file not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/compose/validate-content
// @desc    Validate compose content without saving
// @access  Admin only
router.post('/validate-content', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    

    // Get all actual Docker container names
    let dockerContainerNames = [];
    try {
      const containers = await dockerService.listContainers();
      dockerContainerNames = containers.map(c => c.name);
    } catch (err) {
      console.error('Error listing Docker containers:', err);
    }

    // Get all managed GameServer container names
    const existingServers = await GameServer.find({}, 'containerName');
    const managedNames = existingServers.map(s => s.containerName);

    // Only block if name is in use by a real container or managed server
    const existingNames = [...new Set([...dockerContainerNames, ...managedNames])];

    // Skip docker validation for faster response
    const validation = await composeValidator.validateComposeFile(
      content,
      existingNames,
      true  // skipDockerValidation
    );
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      containerName: validation.containerName
    });
  } catch (error) {
    console.error('Error validating compose content:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
