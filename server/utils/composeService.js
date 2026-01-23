const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Compose deployment service
 * Handles deploying and undeploying Docker Compose files
 */


// All disk operations removed. Compose files are now stored in MongoDB only.

/**
 * Deploy a compose file (docker compose up -d)
 * @param {string} composeId - The ComposeFile document ID
 * @param {string} content - YAML content to deploy
 * @param {string} projectName - Project name for docker compose (usually container name)
 * @returns {Promise<{ success: boolean, output: string, error: string|null }>}
 */
async function deploy(composeId, content, projectName) {
  try {
    // Pipe YAML content directly to docker compose
    const { stdout, stderr } = await execPromise(
      `echo "$CONTENT" | docker compose -p "${projectName}" -f - up -d`,
      {
        env: { ...process.env, CONTENT: content },
        timeout: 120000
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
    // Undeploy by project name only (no file needed)
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
    const running = containers.some(c => c.State === 'running');
    const status = containers.map(c => `${c.Name}: ${c.State}`).join(', ');
    return { running, status, error: null };
  } catch (err) {
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
async function pullImages(composeId, projectName, content) {
  try {
    // Pipe YAML content directly to docker compose
    const { stdout, stderr } = await execPromise(
      `echo "$CONTENT" | docker compose -p "${projectName}" -f - pull`,
      {
        env: { ...process.env, CONTENT: content },
        timeout: 300000
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
  deploy,
  undeploy,
  getComposeStatus,
  pullImages,
  getLogs
};
