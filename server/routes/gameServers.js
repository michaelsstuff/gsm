const express = require('express');
const router = express.Router();
const GameServer = require('../models/GameServer');
const dockerService = require('../utils/dockerService');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
};

// @route   GET /api/servers
// @desc    Get all game servers (public view)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const gameServers = await GameServer.find().select('-commands');
    
    // For each server, check and update its current status
    const updatedServers = await Promise.all(
      gameServers.map(async (server) => {
        const currentStatus = await dockerService.getContainerStatus(server.containerName);
        
        // If status has changed, update in database
        if (currentStatus !== server.status) {
          server.status = currentStatus;
          await server.save();
        }
        
        return server;
      })
    );
    
    res.json(updatedServers);
  } catch (error) {
    console.error('Error fetching game servers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/servers/:id
// @desc    Get game server by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id)
      .select(req.isAuthenticated() && req.user.role === 'admin' ? '+commands' : '-commands');
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    // Update status
    const currentStatus = await dockerService.getContainerStatus(gameServer.containerName);
    if (currentStatus !== gameServer.status) {
      gameServer.status = currentStatus;
      await gameServer.save();
    }
    
    res.json(gameServer);
  } catch (error) {
    console.error('Error fetching game server:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/servers/status/:id
// @desc    Get just the status of a game server
// @access  Public
router.get('/status/:id', async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id).select('containerName status');
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    // Get current status
    const currentStatus = await dockerService.getContainerStatus(gameServer.containerName);
    
    // Update in DB if changed
    if (currentStatus !== gameServer.status) {
      gameServer.status = currentStatus;
      await gameServer.save();
    }
    
    res.json({ status: currentStatus });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;