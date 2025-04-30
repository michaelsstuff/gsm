const express = require('express');
const router = express.Router();
const GameServer = require('../models/GameServer');
const User = require('../models/User');
const dockerService = require('../utils/dockerService');
const backupScheduler = require('../utils/backupScheduler');

// Middleware to check if user is authenticated and an admin
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
// @access  Admin only
router.get('/users', isAdmin, async (req, res) => {
  try {
    // Exclude password field from results
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update a user's role
// @access  Admin only
router.put('/users/:id/role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    // Validate role input
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    
    // Find user by ID
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent admins from demoting themselves
    if (req.user.id === req.params.id && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot demote yourself from admin role' });
    }
    
    // Update user role
    user.role = role;
    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(req.params.id).select('-password');
    
    res.json({
      message: `User role updated to ${role} successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

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
      containerName
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

// @route   GET /api/admin/servers/:id
// @desc    Get a specific game server for editing
// @access  Admin only
router.get('/servers/:id', isAdmin, async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
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
      description
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
    
    // Handle backup command as a special case with async processing
    if (command === 'backup') {
      // Check if a backup is already in progress
      if (gameServer.activeBackupJob && gameServer.activeBackupJob.inProgress) {
        return res.status(409).json({ 
          message: 'A backup operation is already in progress for this server',
          jobStatus: gameServer.activeBackupJob
        });
      }
      
      // Initialize backup job status
      gameServer.activeBackupJob = {
        inProgress: true,
        startedAt: new Date(),
        status: 'pending',
        message: 'Backup operation starting...'
      };
      await gameServer.save();
      
      // Return immediately to prevent timeout
      res.json({ 
        message: 'Backup initiated successfully',
        jobStatus: gameServer.activeBackupJob,
        currentStatus: gameServer.status
      });
      
      // Run backup in background
      (async () => {
        try {
          // Update job status
          gameServer.activeBackupJob.status = 'in_progress';
          gameServer.activeBackupJob.message = 'Stopping server and creating backup...';
          await gameServer.save();
          
          // Execute backup
          const result = await dockerService.runCommand(gameServer.containerName, command);
          
          // Update server and job status after successful backup
          gameServer.activeBackupJob.inProgress = false;
          gameServer.activeBackupJob.status = 'completed';
          gameServer.activeBackupJob.message = result || 'Backup completed successfully';
          gameServer.status = await dockerService.getContainerStatus(gameServer.containerName);
          gameServer.backupSchedule.lastBackup = new Date();
          await gameServer.save();
        } catch (error) {
          console.error(`Background backup error:`, error);
          
          // Update job status on failure
          const errorMessage = error.stderr || error.message || 'Unknown error occurred';
          try {
            gameServer.activeBackupJob.inProgress = false;
            gameServer.activeBackupJob.status = 'failed';
            gameServer.activeBackupJob.message = `Backup failed: ${errorMessage}`;
            gameServer.status = await dockerService.getContainerStatus(gameServer.containerName);
            gameServer.backupSchedule.lastError = {
              message: errorMessage,
              date: new Date()
            };
            await gameServer.save();
          } catch (saveError) {
            console.error('Error updating backup job status:', saveError);
          }
        }
      })();
      
      return;
    }
    
    // For other commands (start, stop, restart), process synchronously
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
    // Include more detailed error information
    const errorMessage = error.stderr || error.message || 'Unknown error occurred';
    res.status(500).json({ 
      message: errorMessage,
      command: req.body.command
    });
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

// @route   PUT /api/admin/servers/:id/backup-schedule
// @desc    Update backup schedule for a game server
// @access  Admin only
router.put('/servers/:id/backup-schedule', isAdmin, async (req, res) => {
  try {
    const { enabled, cronExpression, retention } = req.body;
    
    const gameServer = await GameServer.findById(req.params.id);
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Validate cron expression if provided
    if (cronExpression && !require('node-cron').validate(cronExpression)) {
      return res.status(400).json({ message: 'Invalid cron expression' });
    }

    // Validate retention value
    if (retention !== undefined) {
      if (typeof retention !== 'number' || retention < 1 || retention > 30) {
        return res.status(400).json({ message: 'Retention must be a number between 1 and 30' });
      }
    }

    // Create a new backup schedule object
    const newBackupSchedule = {
      enabled: enabled ?? false,
      cronExpression: cronExpression ?? '0 0 * * *',
      retention: retention ?? 5,
      lastBackup: gameServer.backupSchedule?.lastBackup || null,
      lastError: {
        message: gameServer.backupSchedule?.lastError?.message || null,
        date: gameServer.backupSchedule?.lastError?.date || null
      }
    };

    // Update the server with the new backup schedule
    gameServer.backupSchedule = newBackupSchedule;

    try {
      await gameServer.save();
    } catch (saveError) {
      console.error('Error saving backup schedule:', saveError);
      return res.status(400).json({ message: `Failed to save backup schedule: ${saveError.message}` });
    }

    // Update scheduler
    try {
      if (gameServer.backupSchedule.enabled) {
        backupScheduler.updateJob(gameServer);
      } else {
        backupScheduler.stopJob(gameServer._id.toString());
      }
    } catch (schedulerError) {
      console.error('Error updating backup scheduler:', schedulerError);
      return res.status(500).json({ message: `Backup schedule saved but failed to update scheduler: ${schedulerError.message}` });
    }

    res.json({
      message: 'Backup schedule updated successfully',
      backupSchedule: gameServer.backupSchedule
    });
  } catch (error) {
    console.error('Error updating backup schedule:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid backup schedule settings: ' + error.message });
    } else if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Game server not found' });
    }
    res.status(500).json({ message: 'Failed to update backup schedule: ' + error.message });
  }
});

// @route   GET /api/admin/servers/:id/backup-status
// @desc    Get backup status and history for a game server
// @access  Admin only
router.get('/servers/:id/backup-status', isAdmin, async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Get list of existing backups for this server
    const backupPath = '/app/backups';
    const { stdout: backupFiles } = await require('util').promisify(require('child_process').exec)(
      `ls -t ${backupPath}/${gameServer.containerName}-*.tar.gz 2>/dev/null || true`
    );

    const backups = backupFiles.trim().split('\n')
      .filter(file => file) // Remove empty lines
      .map(file => {
        const match = file.match(/(\d{8}-\d{6})\.tar\.gz$/);
        return match ? {
          filename: file.split('/').pop(),
          timestamp: match[1],
          date: new Date(
            match[1].replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z')
          )
        } : null;
      })
      .filter(backup => backup); // Remove null entries

    res.json({
      backupSchedule: gameServer.backupSchedule,
      backups
    });
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/servers/:id/backup-job
// @desc    Get current backup job status for a game server
// @access  Admin only
router.get('/servers/:id/backup-job', isAdmin, async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Return the current backup job status
    res.json({
      activeBackupJob: gameServer.activeBackupJob,
      serverStatus: gameServer.status
    });
  } catch (error) {
    console.error('Error getting backup job status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;