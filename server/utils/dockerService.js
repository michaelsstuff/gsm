const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Docker service to interact with Docker containers
 */
const dockerService = {
  /**
   * Check if a container exists
   * @param {string} containerName - Name of the container
   * @returns {Promise<boolean>} - True if container exists
   */
  async containerExists(containerName) {
    try {
      const containers = await docker.listContainers({ all: true });
      return containers.some(container => {
        return container.Names.some(name => name === `/${containerName}` || name === containerName);
      });
    } catch (error) {
      console.error('Error checking container existence:', error);
      return false;
    }
  },

  /**
   * Get container status (running, stopped, error)
   * @param {string} containerName - Name of the container
   * @returns {Promise<string>} - Status of the container
   */
  async getContainerStatus(containerName) {
    try {
      const containers = await docker.listContainers({ all: true });
      const container = containers.find(container => {
        return container.Names.some(name => name === `/${containerName}` || name === containerName);
      });

      if (!container) {
        return 'error';
      }

      return container.State === 'running' ? 'running' : 'stopped';
    } catch (error) {
      console.error('Error getting container status:', error);
      return 'error';
    }
  },

  /**
   * Run a command on a container based on action type
   * @param {string} containerName - Name of the container
   * @param {string} command - Command type (start, stop, restart) or custom command
   * @returns {Promise<string>} - Command output
   */
  async runCommand(containerName, command) {
    try {
      // Handle standard docker commands directly
      if (['start', 'stop', 'restart'].includes(command)) {
        const dockerCommand = `docker ${command} ${containerName}`;
        const { stdout, stderr } = await execPromise(dockerCommand);
        
        if (stderr && !stderr.includes('Container is already')) {
          console.warn(`Command warning for ${containerName}:`, stderr);
        }
        
        return stdout || `Container ${command}ed successfully`;
      } 
      // Special case for backup - using internal backup script
      else if (command === 'backup') {
        try {
          // Stop the container first
          console.log(`Stopping container ${containerName} before backup...`);
          await this.stopContainer(containerName);

          // Execute backup using the internal script
          const backupScript = '/app/scripts/backup_container.sh';
          console.log(`Executing backup script for ${containerName}...`);
          const { stdout, stderr } = await execPromise(`${backupScript} ${containerName}`);
          
          if (stderr) {
            console.warn(`Backup warning for ${containerName}:`, stderr);
          }

          // Start the container again regardless of backup result
          console.log(`Starting container ${containerName} after backup...`);
          await this.startContainer(containerName);
          
          return stdout || `Backup completed successfully for container ${containerName}`;
        } catch (error) {
          // Make sure to start the container even if backup failed
          console.log(`Ensuring container ${containerName} is started after error...`);
          await this.startContainer(containerName);

          console.error('Backup script error:', error.message);
          throw new Error(`Backup failed: ${error.message}`);
        }
      }
      // For other custom commands, run inside the container
      else {
        const dockerCommand = `docker exec ${containerName} /bin/sh -c "${command}"`;
        const { stdout, stderr } = await execPromise(dockerCommand);
        
        if (stderr) {
          console.warn(`Command warning for ${containerName}:`, stderr);
        }
        
        return stdout || 'Command executed successfully';
      }
    } catch (error) {
      console.error(`Error running command on container ${containerName}:`, error);
      throw new Error(`Failed to execute command on container: ${error.message}`);
    }
  },

  /**
   * Get a list of all Docker containers
   * @returns {Promise<Array>} - List of containers
   */
  async listContainers() {
    try {
      const containers = await docker.listContainers({ all: true });
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        state: container.State,
        status: container.Status
      }));
    } catch (error) {
      console.error('Error listing containers:', error);
      return [];
    }
  },

  /**
   * Start a Docker container
   * @param {string} containerName - Name of the container to start
   * @returns {Promise<boolean>} - True if successful
   */
  async startContainer(containerName) {
    try {
      const container = docker.getContainer(containerName);
      await container.start();
      return true;
    } catch (error) {
      console.error(`Error starting container ${containerName}:`, error);
      return false;
    }
  },

  /**
   * Stop a Docker container
   * @param {string} containerName - Name of the container to stop
   * @returns {Promise<boolean>} - True if successful
   */
  async stopContainer(containerName) {
    try {
      const container = docker.getContainer(containerName);
      await container.stop();
      return true;
    } catch (error) {
      console.error(`Error stopping container ${containerName}:`, error);
      return false;
    }
  },

  /**
   * Restart a Docker container
   * @param {string} containerName - Name of the container to restart
   * @returns {Promise<boolean>} - True if successful
   */
  async restartContainer(containerName) {
    try {
      const container = docker.getContainer(containerName);
      await container.restart();
      return true;
    } catch (error) {
      console.error(`Error restarting container ${containerName}:`, error);
      return false;
    }
  },

  /**
   * Get logs from a Docker container
   * @param {string} containerName - Name of the container
   * @param {number} lines - Number of lines to retrieve (default: 100)
   * @returns {Promise<string>} - Container logs
   */
  async getContainerLogs(containerName, lines = 100) {
    try {
      // Using docker logs command as it's more flexible than the dockerode API
      const logCommand = `docker logs --tail ${lines} ${containerName}`;
      const { stdout, stderr } = await execPromise(logCommand);
      
      // For container logs, stderr is part of the output (docker outputs to stderr)
      return stdout + stderr;
    } catch (error) {
      console.error(`Error getting logs for container ${containerName}:`, error);
      throw new Error(`Failed to get container logs: ${error.message}`);
    }
  }
};

module.exports = dockerService;