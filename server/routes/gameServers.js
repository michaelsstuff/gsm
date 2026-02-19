const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const GameServer = require('../models/GameServer');
const dockerService = require('../utils/dockerService');
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
};

const gameServerRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(gameServerRouteLimiter);

// @route   GET /api/servers
// @desc    Get all game servers (public view)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const gameServers = await GameServer.find();
    
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
    const gameServer = await GameServer.findById(req.params.id);
    
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

// @route   GET /api/servers/:id/mods
// @desc    List files in the mods directory
// @access  Public
router.get('/:id/mods', async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!gameServer.modsDirectory) {
      return res.status(404).json({ message: 'Mods directory not configured for this server' });
    }
    
    // Get file listing from container
    const containerName = gameServer.containerName;
    const modsPath = gameServer.modsDirectory;
    
    // Use docker exec to list files in the mods directory
    const dockerExec = spawn('docker', ['exec', containerName, 'find', modsPath, '-type', 'f', '-printf', '%P\t%s\t%T@\n'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    dockerExec.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    dockerExec.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    dockerExec.on('close', (code) => {
      if (code !== 0) {
        console.error('Docker exec error:', errorOutput);
        return res.status(500).json({ message: 'Failed to list mod files' });
      }
      
      try {
        const files = output.trim().split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [relativePath, size, timestamp] = line.split('\t');
            return {
              name: path.basename(relativePath),
              path: relativePath,
              size: parseInt(size) || 0,
              modified: new Date(parseFloat(timestamp) * 1000),
              isFile: true
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        
        res.json({
          serverName: gameServer.name,
          modsDirectory: modsPath,
          files
        });
      } catch (parseError) {
        console.error('Error parsing file list:', parseError);
        res.status(500).json({ message: 'Failed to parse mod files list' });
      }
    });
    
  } catch (error) {
    console.error('Error listing mod files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/servers/:id/mods/download/:filename
// @desc    Download a specific mod file
// @access  Public
router.get('/:id/mods/download/*filepath', async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!gameServer.modsDirectory) {
      return res.status(404).json({ message: 'Mods directory not configured for this server' });
    }
    
    // Get the file path from the URL (everything after /download/)
    const filePath = req.params.filepath.join('/');
    if (!filePath) {
      return res.status(400).json({ message: 'File path not specified' });
    }
    
    // Security: ensure the file path doesn't contain directory traversal attempts
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    const containerName = gameServer.containerName;
    const modsPath = gameServer.modsDirectory;
    const fullPath = path.posix.join(modsPath, filePath);
    
    // Get file size first to set Content-Length header
    const statProcess = spawn('docker', ['exec', containerName, 'stat', '-c', '%s', fullPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let sizeOutput = '';
    let sizeError = '';
    
    statProcess.stdout.on('data', (data) => {
      sizeOutput += data.toString();
    });
    
    statProcess.stderr.on('data', (data) => {
      sizeError += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      statProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Error getting file size:', sizeError);
          reject(new Error('File not found or access denied'));
        } else {
          resolve();
        }
      });
      
      statProcess.on('error', (error) => {
        reject(error);
      });
    });
    
    const fileSize = parseInt(sizeOutput.trim());
    
    // Set appropriate headers for file download
    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileSize);
    
    // Use docker exec to cat the file and pipe it to response
    const dockerExec = spawn('docker', ['exec', containerName, 'cat', fullPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    dockerExec.stdout.pipe(res);
    
    dockerExec.stderr.on('data', (data) => {
      console.error('Docker exec error:', data.toString());
    });
    
    dockerExec.on('close', (code) => {
      if (code !== 0) {
        if (!res.headersSent) {
          res.status(404).json({ message: 'File not found or access denied' });
        }
      }
    });
    
    dockerExec.on('error', (error) => {
      console.error('Docker exec spawn error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to download file' });
      }
    });
    
  } catch (error) {
    console.error('Error downloading mod file:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// @route   POST /api/servers/:id/mods/download-bulk
// @desc    Download multiple mod files as a zip archive
// @access  Public
router.post('/:id/mods/download-bulk', async (req, res) => {
  try {
    const gameServer = await GameServer.findById(req.params.id);
    
    if (!gameServer) {
      return res.status(404).json({ message: 'Game server not found' });
    }
    
    if (!gameServer.modsDirectory) {
      return res.status(404).json({ message: 'Mods directory not configured for this server' });
    }
    
    const { files, downloadAll = false } = req.body;
    
    if (!downloadAll && (!files || !Array.isArray(files) || files.length === 0)) {
      return res.status(400).json({ message: 'No files specified for download' });
    }
    
    const containerName = gameServer.containerName;
    const modsPath = gameServer.modsDirectory;
    
    // Security: validate file paths
    if (!downloadAll) {
      for (const filePath of files) {
        if (filePath.includes('..') || filePath.startsWith('/')) {
          return res.status(400).json({ message: 'Invalid file path detected' });
        }
      }
    }
    
    // Set appropriate headers for zip download
    const zipFilename = downloadAll ? 
      `${gameServer.name.replace(/[^a-zA-Z0-9]/g, '_')}_all_mods.zip` :
      `${gameServer.name.replace(/[^a-zA-Z0-9]/g, '_')}_selected_mods.zip`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Content-Type', 'application/zip');
    
    // Create zip archive using archiver
    const archive = archiver('zip', {
      zlib: { level: 6 } // Compression level (0-9)
    });
    
    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to create zip archive' });
      }
    });
    
    // Pipe archive data to the response
    archive.pipe(res);
    
    // Get list of files to download
    let filesToDownload = [];
    
    if (downloadAll) {
      // Get all files from the mods directory
      const dockerExec = spawn('docker', ['exec', containerName, 'find', modsPath, '-type', 'f', '-printf', '%P\n'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      dockerExec.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      dockerExec.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        dockerExec.on('close', (code) => {
          if (code !== 0) {
            console.error('Docker exec error:', errorOutput);
            reject(new Error('Failed to list files'));
          } else {
            filesToDownload = output.trim().split('\n').filter(line => line.trim());
            resolve();
          }
        });
        
        dockerExec.on('error', (error) => {
          reject(error);
        });
      });
    } else {
      filesToDownload = files;
    }
    
    // Add each file to the archive
    for (const filePath of filesToDownload) {
      const fullPath = path.posix.join(modsPath, filePath);
      
      // Use docker exec to cat the file and add it to the archive
      const catProcess = spawn('docker', ['exec', containerName, 'cat', fullPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Add the file stream to the archive with its relative path
      archive.append(catProcess.stdout, { name: filePath });
      
      // Log any errors but continue with other files
      catProcess.stderr.on('data', (data) => {
        console.error('Error reading file during bulk download:', { filePath, error: data.toString() });
      });
      
      // Wait for the cat process to complete
      await new Promise((resolve) => {
        catProcess.on('close', resolve);
        catProcess.on('error', (err) => {
          console.error('Error spawning cat process during bulk download:', { filePath, error: err });
          resolve();
        });
      });
    }
    
    // Finalize the archive (this will trigger the 'end' event)
    await archive.finalize();
    
  } catch (error) {
    console.error('Error creating bulk download:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

module.exports = router;
