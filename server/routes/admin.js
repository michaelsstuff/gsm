const express = require('express');
const router = express.Router();
const GameServer = require('../models/GameServer');
const dockerService = require('../utils/dockerService');

// Middleware to check if user is authenticated and an admin
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// @route   POST /api/admin/servers
// @desc    Create a new game server
// @access  Admin only
router.post('/servers', isAdmin, async (req, res) => {
  try {
    const {
      name,
      connectionString,
      logo,
      steamAppId,
      websiteUrl,
      description,
      containerName,
      commands
    } = req.body;

    // Check if container exists
    const containerExists = await dockerService.containerExists(containerName);
    if (!containerExists) {
      return res.status(400).json({ message: 'Docker container does not exist' });
    }

    // Check if game server with this container name already exists
    const existingServer = await GameServer.findOne({ containerName });
    if (existingServer) {
      return res.status(400).json({ message: 'Game server with this container name already exists' });
    }

    // Create new game server
    const gameServer = new GameServer({
      name,
      connectionString,
      logo,
      steamAppId,
      websiteUrl,
      description,
      containerName,
      commands: commands || {},
      status: await dockerService.getContainerStatus(containerName)
    });

    await gameServer.save();
    
    res.status(201).json({
      message: 'Game server created successfully',
      gameServer
    });
  } catch (error) {
    console.error('Error creating game server:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/servers/:id
// @desc    Update a game server
// @access  Admin only
router.put('/servers/:id', isAdmin, async (req, res) => {
  try {
    const {
      name,
      connectionString,
      logo,
      steamAppId,
      websiteUrl,
      description,
      commands
    } = req.body;

    // Find game server
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Update fields
    if (name) gameServer.name = name;
    if (connectionString) gameServer.connectionString = connectionString;
    if (logo) gameServer.logo = logo;
    if (steamAppId) gameServer.steamAppId = steamAppId;
    if (websiteUrl) gameServer.websiteUrl = websiteUrl;
    if (description) gameServer.description = description;
    if (commands) {
      if (commands.start) gameServer.commands.start = commands.start;
      if (commands.stop) gameServer.commands.stop = commands.stop;
      if (commands.backup) gameServer.commands.backup = commands.backup;
      if (commands.restart) gameServer.commands.restart = commands.restart;
    }

    await gameServer.save();
    
    res.json({
      message: 'Game server updated successfully',
      gameServer
    });
  } catch (error) {
    console.error('Error updating game server:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/servers/:id
// @desc    Delete a game server
// @access  Admin only
router.delete('/servers/:id', isAdmin, async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    await gameServer.deleteOne();
    
    res.json({ message: 'Game server removed' });
  } catch (error) {
    console.error('Error deleting game server:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/servers/:id/command
// @desc    Run a command on game server
// @access  Admin only
router.post('/servers/:id/command', isAdmin, async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!['start', 'stop', 'restart', 'backup'].includes(command)) {
      return res.status(400).json({ message: 'Invalid command' });
    }

    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // For standard commands (start, stop, restart, backup), use the command name directly
    // dockerService now knows to call the external backup script for 'backup'
    const result = await dockerService.runCommand(gameServer.containerName, command);

    // Update server status after command execution
    gameServer.status = await dockerService.getContainerStatus(gameServer.containerName);
    await gameServer.save();

    res.json({ 
      message: `Command '${command}' executed successfully`,
      result,
      currentStatus: gameServer.status
    });
  } catch (error) {
    console.error(`Error running command:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/servers
// @desc    Get all game servers (admin view with commands)
// @access  Admin only
router.get('/servers', isAdmin, async (req, res) => {
  try {
    const gameServers = await GameServer.find();
    res.json(gameServers);
  } catch (error) {
    console.error('Error fetching game servers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/containers
// @desc    Get all Docker containers
// @access  Admin only
router.get('/containers', isAdmin, async (req, res) => {
  try {
    const containers = await dockerService.listContainers();
    res.json(containers);
  } catch (error) {
    console.error('Error listing Docker containers:', error);
    res.status(500).json({ message: 'Failed to list Docker containers' });
  }
});

// @route   GET /api/admin/servers/:id/logs
// @desc    Get container logs for a game server
// @access  Admin only
router.get('/servers/:id/logs', isAdmin, async (req, res) => {
  try {
    const { lines } = req.query;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    const logs = await dockerService.getContainerLogs(
      gameServer.containerName,
      lines ? parseInt(lines, 10) : 100
    );
    
    res.json({
      logs,
      containerName: gameServer.containerName
    });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    res.status(500).json({ message: 'Failed to retrieve logs' });
  }
});

module.exports = router;