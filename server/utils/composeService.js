const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

// Directory for storing compose files persistently
const COMPOSE_DIR = process.env.COMPOSE_FILES_PATH || '/app/compose-files';

/**
 * Compose deployment service
 * Handles deploying and undeploying Docker Compose files
 */

/**
 * Ensure compose directory exists
 */
async function ensureComposeDir() {
  try {
    await fs.mkdir(COMPOSE_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating compose directory:', err.message);
    throw err;
  }
}

/**
 * Get the compose file path for a given compose file ID
 * @param {string} composeId - The ComposeFile document ID
 * @returns {string} Path to the compose file directory
 */
function getComposeFilePath(composeId) {
  return path.join(COMPOSE_DIR, composeId);
}

/**
 * Write compose file to disk for deployment
 * @param {string} composeId - The ComposeFile document ID
 * @param {string} content - YAML content
 * @returns {Promise<string>} Path to the written compose file
 */
async function writeComposeFile(composeId, content) {
  await ensureComposeDir();
  
  const composeDir = getComposeFilePath(composeId);
  await fs.mkdir(composeDir, { recursive: true });
  
  const filePath = path.join(composeDir, 'docker-compose.yml');
  await fs.writeFile(filePath, content, 'utf8');
  
  return filePath;
}

/**
 * Delete compose file from disk
 * @param {string} composeId - The ComposeFile document ID
 */
async function deleteComposeFile(composeId) {
  const composeDir = getComposeFilePath(composeId);
  
  try {
    const filePath = path.join(composeDir, 'docker-compose.yml');
    await fs.unlink(filePath);
    await fs.rmdir(composeDir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error deleting compose file:', err.message);
      throw err;
    }
  }
}

/**
 * Deploy a compose file (docker compose up -d)
 * @param {string} composeId - The ComposeFile document ID
 * @param {string} content - YAML content to deploy
 * @param {string} projectName - Project name for docker compose (usually container name)
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function deploy(composeId, content, projectName) {
  try {
    const filePath = await writeComposeFile(composeId, content);
    const composeDir = getComposeFilePath(composeId);
    
    // Run docker compose up with project name
    const { stdout, stderr } = await execPromise(
      `docker compose -p "${projectName}" -f "${filePath}" up -d`,
      { 
        cwd: composeDir,
        timeout: 120000  // 2 minute timeout for pulling images
      }
    );
    
    const output = stdout + (stderr ? `\n${stderr}` : '');
    
    return {
      success: true,
      output: output.trim(),
      error: null
    };
  } catch (err) {
    const errorMsg = err.stderr || err.message || 'Unknown deployment error';
    console.error('Compose deploy error:', errorMsg);
    
    return {
      success: false,
      output: err.stdout || '',
      error: errorMsg
    };
  }
}

/**
 * Undeploy a compose file (docker compose down)
 * @param {string} composeId - The ComposeFile document ID
 * @param {string} projectName - Project name for docker compose
 * @param {boolean} removeVolumes - Whether to remove volumes (default: false)
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function undeploy(composeId, projectName, removeVolumes = false) {
  try {
    const composeDir = getComposeFilePath(composeId);
    const filePath = path.join(composeDir, 'docker-compose.yml');
    
    // Check if compose file exists
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, try to undeploy by project name only
      const volumeFlag = removeVolumes ? ' -v' : '';
      const { stdout, stderr } = await execPromise(
        `docker compose -p "${projectName}" down${volumeFlag}`,
        { timeout: 60000 }
      );
      
      return {
        success: true,
        output: (stdout + (stderr ? `\n${stderr}` : '')).trim(),
        error: null
      };
    }
    
    const volumeFlag = removeVolumes ? ' -v' : '';
    const { stdout, stderr } = await execPromise(
      `docker compose -p "${projectName}" -f "${filePath}" down${volumeFlag}`,
      { 
        cwd: composeDir,
        timeout: 60000  // 1 minute timeout
      }
    );
    
    const output = stdout + (stderr ? `\n${stderr}` : '');
    
    return {
      success: true,
      output: output.trim(),
      error: null
    };
  } catch (err) {
    const errorMsg = err.stderr || err.message || 'Unknown undeploy error';
    console.error('Compose undeploy error:', errorMsg);
    
    return {
      success: false,
      output: err.stdout || '',
      error: errorMsg
    };
  }
}

/**
 * Get container status from a deployed compose
 * @param {string} projectName - Project name for docker compose
 * @returns {Promise<{ running: boolean, status: string, error: string|null }>}
 */
async function getComposeStatus(projectName) {
  try {
    const { stdout } = await execPromise(
      `docker compose -p "${projectName}" ps --format json`,
      { timeout: 10000 }
    );
    
    if (!stdout.trim()) {
      return { running: false, status: 'not running', error: null };
    }
    
    // Parse JSON output (may be multiple lines for multiple containers)
    const lines = stdout.trim().split('\n');
    const containers = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    if (containers.length === 0) {
      return { running: false, status: 'not running', error: null };
    }
    
    // Check if main container is running
    const running = containers.some(c => c.State === 'running');
    const status = containers.map(c => `${c.Name}: ${c.State}`).join(', ');
    
    return { running, status, error: null };
  } catch (err) {
    // If compose project doesn't exist, not an error
    if (err.stderr && err.stderr.includes('no configuration file')) {
      return { running: false, status: 'not deployed', error: null };
    }
    
    return { 
      running: false, 
      status: 'unknown', 
      error: err.stderr || err.message 
    };
  }
}

/**
 * Pull latest images for a compose file
 * @param {string} composeId - The ComposeFile document ID
 * @param {string} projectName - Project name for docker compose
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function pullImages(composeId, projectName) {
  try {
    const composeDir = getComposeFilePath(composeId);
    const filePath = path.join(composeDir, 'docker-compose.yml');
    
    const { stdout, stderr } = await execPromise(
      `docker compose -p "${projectName}" -f "${filePath}" pull`,
      { 
        cwd: composeDir,
        timeout: 300000  // 5 minute timeout for pulling
      }
    );
    
    const output = stdout + (stderr ? `\n${stderr}` : '');
    
    return {
      success: true,
      output: output.trim(),
      error: null
    };
  } catch (err) {
    const errorMsg = err.stderr || err.message || 'Unknown pull error';
    
    return {
      success: false,
      output: err.stdout || '',
      error: errorMsg
    };
  }
}

/**
 * Get logs from a compose container
 * @param {string} projectName - Project name for docker compose
 * @param {number} lines - Number of lines to retrieve (default: 100)
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function getLogs(projectName, lines = 100) {
  try {
    const { stdout, stderr } = await execPromise(
      `docker compose -p "${projectName}" logs --tail=${lines}`,
      { timeout: 30000 }
    );
    
    return {
      success: true,
      output: stdout + (stderr || ''),
      error: null
    };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err.stderr || err.message
    };
  }
}

module.exports = {
  ensureComposeDir,
  getComposeFilePath,
  writeComposeFile,
  deleteComposeFile,
  deploy,
  undeploy,
  getComposeStatus,
  pullImages,
  getLogs,
  COMPOSE_DIR
};
