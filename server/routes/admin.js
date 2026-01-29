const express = require('express');
const router = express.Router();
const GameServer = require('../models/GameServer');
const User = require('../models/User');
const dockerService = require('../utils/dockerService');
const backupScheduler = require('../utils/backupScheduler');
const { searchSteamGame } = require('../utils/steamLookup');

// Middleware to check if user is authenticated and an admin
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// @route   GET /api/steam-lookup
// @desc    Lookup Steam game info by name
// @access  Admin only
router.get('/steam-lookup', isAdmin, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ message: 'Missing game name' });
  try {
    const result = await searchSteamGame(name);
    if (!result) return res.json({});
    const { mapSteamInfoToGameServerFields } = require('../utils/steamLookup');
    const mapped = mapSteamInfoToGameServerFields(result, name);
    res.json({
      appId: mapped.steamAppId,
      name: mapped.name,
      storeUrl: mapped.websiteUrl,
      logoUrl: mapped.logo,
      description: mapped.description
    });
  } catch (err) {
    console.error('Steam lookup error:', err);
    res.status(500).json({ message: 'Steam lookup failed' });
  }
});

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

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
// @access  Admin only
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    // Find user by ID
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent admins from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({
      message: `User ${user.username} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    
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
      modsDirectory,
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
      modsDirectory,
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
      description,
      modsDirectory
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
    if (modsDirectory !== undefined) gameServer.modsDirectory = modsDirectory;

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

    // Remove the Docker container if it exists
    const dockerService = require('../utils/dockerService');
    if (gameServer.containerName) {
      try {
        const exists = await dockerService.containerExists(gameServer.containerName);
        if (exists) {
          await dockerService.removeContainer(gameServer.containerName);
        }
      } catch (err) {
        console.error('Error removing Docker container:', err);
      }
    }

    await gameServer.deleteOne();
    res.json({ message: 'Game server and Docker container removed' });
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
    const { enabled, cronExpression, retention, notifyOnBackup } = req.body;
    
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
      notifyOnBackup: notifyOnBackup ?? true,
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
    const backupPath = process.env.BACKUP_PATH || '/app/backups';
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

// @route   PUT /api/admin/servers/:id/discord-webhook
// @desc    Update Discord webhook settings for a game server
// @access  Admin only
router.put('/servers/:id/discord-webhook', isAdmin, async (req, res) => {
  try {
    const { enabled, url, notifyOnStart, notifyOnStop } = req.body;
    
    const gameServer = await GameServer.findById(req.params.id);
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Validate webhook URL if provided and enabled
    if (enabled && url) {
      const webhookUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[\w-]+$/;
      if (!webhookUrlPattern.test(url)) {
        return res.status(400).json({ message: 'Invalid Discord webhook URL' });
      }
    }

    // Create new Discord webhook settings object
    const newDiscordWebhook = {
      enabled: enabled ?? false,
      url: url ?? '',
      notifyOnStart: notifyOnStart ?? true,
      notifyOnStop: notifyOnStop ?? true
    };

    // Update the server with the new webhook settings
    gameServer.discordWebhook = newDiscordWebhook;

    await gameServer.save();
    
    res.json({
      message: 'Discord webhook settings updated successfully',
      discordWebhook: gameServer.discordWebhook
    });
  } catch (error) {
    console.error('Error updating Discord webhook settings:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Game server not found' });
    }
    res.status(500).json({ message: 'Failed to update Discord webhook settings: ' + error.message });
  }
});

// @route   GET /api/admin/servers/:id/files
// @desc    Get file listing for a game server container
// @access  Admin only
router.get('/servers/:id/files', isAdmin, async (req, res) => {
  try {
    const { path } = req.query;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    // Get directory contents using docker exec
    const containerName = gameServer.containerName;
    let dirPath = path || '/';
    
    // Normalize path to prevent directory traversal
    dirPath = require('path').normalize(dirPath).replace(/^(\.\.[\/\\])+/, '');
    
    console.log(`Listing directory ${dirPath} in container ${containerName}`);
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Get directory listing with a simplified approach using find
      const { stdout, stderr } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} /bin/sh -c "cd '${dirPath}' && ls -la | grep -v '^total'"`
      );
      
      if (stderr && !stderr.includes('No such file or directory')) {
        console.error('Error listing directory:', stderr);
        return res.status(500).json({ message: 'Failed to list directory contents: ' + stderr });
      }
      
      // Parse ls output to get file listing
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      const files = [];
      
      for (const line of lines) {
        try {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 9) continue;
          
          const permissions = parts[0];
          const size = parts[4];
          // The filename might contain spaces, so we need to join all parts after the date and time (position 8)
          const name = parts.slice(8).join(' ');
          const isDirectory = permissions.startsWith('d');
          
          // Skip current and parent directory references
          if (name === '.' || name === '..') continue;
          
          files.push({
            name,
            isDirectory,
            permissions,
            size,
            path: require('path').join(dirPath, name)
          });
        } catch (err) {
          console.error('Error parsing file entry:', err, line);
        }
      }
      
      res.json({
        path: dirPath,
        files
      });
    } catch (execError) {
      console.error('Docker exec error:', execError);
      const errorMessage = execError.stderr || execError.message || 'Unknown Docker error';
      return res.status(500).json({ message: 'Failed to execute Docker command: ' + errorMessage });
    }
  } catch (error) {
    console.error('Error getting file listing:', error);
    res.status(500).json({ message: 'Failed to get file listing: ' + error.message });
  }
});

// @route   GET /api/admin/servers/:id/files/content
// @desc    Get file content from a game server container
// @access  Admin only
router.get('/servers/:id/files/content', isAdmin, async (req, res) => {
  try {
    const { path } = req.query;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!path) {
      return res.status(400).json({ message: 'File path is required' });
    }
    
    // Normalize path to prevent directory traversal
    const filePath = require('path').normalize(path).replace(/^(\.\.[\/\\])+/, '');
    const containerName = gameServer.containerName;
    
    console.log(`Getting file content for ${filePath} in container ${containerName}`);
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Check if file exists and is not a directory
      const { stdout: fileType, stderr: fileTypeErr } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} /bin/sh -c "[ -f '${filePath}' ] && echo 'file' || echo 'not-file'"`
      );
      
      if (fileType.trim() !== 'file') {
        console.error('File type check error:', fileTypeErr);
        return res.status(400).json({ message: 'Not a file or file does not exist' });
      }
      
      // Get file content
      const { stdout, stderr } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} cat "${filePath}"`
      );
      
      if (stderr) {
        console.error('Error reading file:', stderr);
        return res.status(500).json({ message: 'Failed to read file content: ' + stderr });
      }
      
      res.json({
        path: filePath,
        content: stdout
      });
    } catch (execError) {
      console.error('Docker exec error:', execError);
      const errorMessage = execError.stderr || execError.message || 'Unknown Docker error';
      return res.status(500).json({ message: 'Failed to execute Docker command: ' + errorMessage });
    }
  } catch (error) {
    console.error('Error getting file content:', error);
    res.status(500).json({ message: 'Failed to get file content: ' + error.message });
  }
});

// @route   POST /api/admin/servers/:id/files/save
// @desc    Save file content to a game server container
// @access  Admin only
router.post('/servers/:id/files/save', isAdmin, async (req, res) => {
  try {
    const { path, content } = req.body;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!path) {
      return res.status(400).json({ message: 'File path is required' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ message: 'File content is required' });
    }
    
    // Normalize path to prevent directory traversal
    const filePath = require('path').normalize(path).replace(/^(\.\.[\/\\])+/, '');
    const containerName = gameServer.containerName;
    
    console.log(`Saving file content to ${filePath} in container ${containerName}`);
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Create a temporary file and copy it to the container
      const tempFile = `/tmp/gsm-file-edit-${Date.now()}`;
      await require('fs').promises.writeFile(tempFile, content);
      
      try {
        // Properly quote the source and destination paths to handle spaces in filenames
        await require('util').promisify(require('child_process').exec)(
          `docker cp "${tempFile}" "${containerName}:${filePath}"`
        );
        
        // Clean up temp file
        await require('fs').promises.unlink(tempFile);
        
        res.json({
          message: 'File saved successfully',
          path: filePath
        });
      } catch (err) {
        console.error('Error saving file:', err);
        // Clean up temp file
        try {
          await require('fs').promises.unlink(tempFile);
        } catch (unlinkErr) {
          console.error('Error removing temp file:', unlinkErr);
        }
        
        return res.status(500).json({ message: 'Failed to save file: ' + (err.stderr || err.message) });
      }
    } catch (execError) {
      console.error('Docker exec error:', execError);
      const errorMessage = execError.stderr || execError.message || 'Unknown Docker error';
      return res.status(500).json({ message: 'Failed to execute Docker command: ' + errorMessage });
    }
  } catch (error) {
    console.error('Error saving file content:', error);
    res.status(500).json({ message: 'Failed to save file content: ' + error.message });
  }
});

// @route   POST /api/admin/servers/:id/files/upload
// @desc    Upload a file to a game server container
// @access  Admin only
router.post('/servers/:id/files/upload', isAdmin, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No file was uploaded' });
    }

    const gameServer = await GameServer.findById(req.params.id);
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }

    // Get upload path and file
    const uploadPath = req.body.path;
    const uploadedFile = req.files.file;
    
    if (!uploadPath) {
      return res.status(400).json({ message: 'Upload path is required' });
    }

    // Normalize path to prevent directory traversal
    const containerPath = require('path').normalize(uploadPath).replace(/^(\.\.[\/\\])+/, '');
    const containerName = gameServer.containerName;
    const filePath = require('path').join(containerPath, uploadedFile.name);
    
    console.log(`Uploading file ${uploadedFile.name} to ${filePath} in container ${containerName}`);

    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Create a temporary file
      const tempFile = `/tmp/gsm-file-upload-${Date.now()}`;
      await uploadedFile.mv(tempFile);
      
      // Copy the temp file to the container - properly quote the destination to handle spaces in filenames
      await require('util').promisify(require('child_process').exec)(
        `docker cp "${tempFile}" "${containerName}:${filePath}"`
      );
      
      // Clean up temp file
      await require('fs').promises.unlink(tempFile);
      
      res.json({
        message: 'File uploaded successfully',
        path: filePath
      });
    } catch (err) {
      console.error('Error uploading file:', err);
      return res.status(500).json({ message: 'Failed to upload file: ' + (err.stderr || err.message) });
    }
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({ message: 'Failed to handle file upload: ' + error.message });
  }
});

// @route   DELETE /api/admin/servers/:id/files
// @desc    Delete a file from a game server container
// @access  Admin only
router.delete('/servers/:id/files', isAdmin, async (req, res) => {
  try {
    const { path } = req.query;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!path) {
      return res.status(400).json({ message: 'File path is required' });
    }
    
    // Normalize path to prevent directory traversal
    const filePath = require('path').normalize(path).replace(/^(\.\.[\/\\])+/, '');
    const containerName = gameServer.containerName;
    
    console.log(`Deleting file ${filePath} in container ${containerName}`);
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Check if file exists
      const { stdout: fileExists, stderr: fileExistsErr } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} /bin/sh -c "[ -e '${filePath}' ] && echo 'exists' || echo 'not-exists'"`
      );
      
      if (fileExists.trim() !== 'exists') {
        return res.status(400).json({ message: 'File does not exist' });
      }
      
      // Check if it's a directory
      const { stdout: isDir } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} /bin/sh -c "[ -d '${filePath}' ] && echo 'directory' || echo 'file'"`
      );
      
      // Delete the file or directory
      if (isDir.trim() === 'directory') {
        await require('util').promisify(require('child_process').exec)(
          `docker exec ${containerName} /bin/sh -c "rm -rf '${filePath}'"`
        );
      } else {
        await require('util').promisify(require('child_process').exec)(
          `docker exec ${containerName} /bin/sh -c "rm '${filePath}'"`
        );
      }
      
      res.json({
        message: `${isDir.trim() === 'directory' ? 'Directory' : 'File'} deleted successfully`,
        path: filePath
      });
    } catch (err) {
      console.error('Error deleting file:', err);
      return res.status(500).json({ message: 'Failed to delete file: ' + (err.stderr || err.message) });
    }
  } catch (error) {
    console.error('Error handling file deletion:', error);
    res.status(500).json({ message: 'Failed to handle file deletion: ' + error.message });
  }
});

// @route   GET /api/admin/servers/:id/volumes
// @desc    Get mounted volumes for a game server container
// @access  Admin only
router.get('/servers/:id/volumes', isAdmin, async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    const containerName = gameServer.containerName;
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Get the container's mount points
      const { stdout } = await require('util').promisify(require('child_process').exec)(
        `docker inspect --format '{{json .Mounts}}' ${containerName}`
      );
      
      // Parse the JSON output
      let mounts = JSON.parse(stdout);
      
      // Filter and format the mounts
      const volumes = mounts.map(mount => ({
        name: mount.Name || mount.Source.split('/').pop(),
        destination: mount.Destination,
        source: mount.Source,
        type: mount.Type,
        mode: mount.Mode,
        rw: mount.RW
      }));
      
      res.json({
        volumes
      });
    } catch (execError) {
      console.error('Docker exec error:', execError);
      const errorMessage = execError.stderr || execError.message || 'Unknown Docker error';
      return res.status(500).json({ message: 'Failed to get container volumes: ' + errorMessage });
    }
  } catch (error) {
    console.error('Error getting mounted volumes:', error);
    res.status(500).json({ message: 'Failed to get mounted volumes: ' + error.message });
  }
});

// @route   GET /api/admin/servers/:id/files/download
// @desc    Download a file from a game server container
// @access  Admin only
router.get('/servers/:id/files/download', isAdmin, async (req, res) => {
  try {
    const { path } = req.query;
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!path) {
      return res.status(400).json({ message: 'File path is required' });
    }
    
    // Normalize path to prevent directory traversal
    const filePath = require('path').normalize(path).replace(/^(\.\.[\/\\])+/, '');
    const containerName = gameServer.containerName;
    
    console.log(`Downloading file ${filePath} from container ${containerName}`);
    
    try {
      // First check if the container is running
      const { stdout: containerStatus } = await require('util').promisify(require('child_process').exec)(
        `docker container inspect -f '{{.State.Status}}' ${containerName}`
      );
      
      if (containerStatus.trim() !== 'running') {
        return res.status(400).json({ message: 'Container is not running. Please start the server first.' });
      }
      
      // Check if file exists and is not a directory
      const { stdout: fileType, stderr: fileTypeErr } = await require('util').promisify(require('child_process').exec)(
        `docker exec ${containerName} /bin/sh -c "[ -f '${filePath}' ] && echo 'file' || echo 'not-file'"`
      );
      
      if (fileType.trim() !== 'file') {
        console.error('File type check error:', fileTypeErr);
        return res.status(400).json({ message: 'Not a file or file does not exist' });
      }
      
      // Create a temporary directory for the download
      const tempDir = `/tmp/gsm-downloads-${Date.now()}`;
      const tempFilePath = `${tempDir}/download`;
      await require('util').promisify(require('child_process').exec)(`mkdir -p ${tempDir}`);
      
      try {
        // Copy the file from the container to the temporary directory
        await require('util').promisify(require('child_process').exec)(
          `docker cp "${containerName}:${filePath}" "${tempFilePath}"`
        );
        
        // Get the filename from the path
        const fileName = filePath.split('/').pop();
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Stream the file as the response
        const fileStream = require('fs').createReadStream(tempFilePath);
        fileStream.pipe(res);
        
        // Clean up the temporary directory after the file has been sent
        fileStream.on('end', async () => {
          try {
            await require('util').promisify(require('child_process').exec)(`rm -rf ${tempDir}`);
          } catch (cleanupErr) {
            console.error('Error cleaning up temporary directory:', cleanupErr);
          }
        });
      } catch (err) {
        // Clean up on error
        try {
          await require('util').promisify(require('child_process').exec)(`rm -rf ${tempDir}`);
        } catch (cleanupErr) {
          console.error('Error cleaning up temporary directory:', cleanupErr);
        }
        
        console.error('Error downloading file:', err);
        return res.status(500).json({ message: 'Failed to download file: ' + (err.stderr || err.message) });
      }
    } catch (execError) {
      console.error('Docker exec error:', execError);
      const errorMessage = execError.stderr || execError.message || 'Unknown Docker error';
      return res.status(500).json({ message: 'Failed to execute Docker command: ' + errorMessage });
    }
  } catch (error) {
    console.error('Error handling file download:', error);
    res.status(500).json({ message: 'Failed to handle file download: ' + error.message });
  }
});

module.exports = router;