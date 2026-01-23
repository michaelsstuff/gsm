const yaml = require('js-yaml');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

/**
 * Compose file validation utility
 * Validates YAML syntax, Docker Compose schema, and security policies
 */

// Paths that should never be mounted from host
const FORBIDDEN_MOUNT_PATHS = [
  '/',
  '/etc',
  '/var/run/docker.sock',
  '/root',
  '/home',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/boot',
  '/proc',
  '/sys',
  '/dev'
];

// Capabilities that trigger warnings (but allowed)
const WARNED_CAPABILITIES = [
  'SYS_ADMIN',
  'NET_ADMIN',
  'SYS_PTRACE',
  'SYS_RAWIO',
  'SYS_MODULE'
];

/**
 * Parse YAML content and return the parsed object
 * @param {string} content - Raw YAML content
 * @returns {{ parsed: object|null, error: string|null }}
 */
function parseYaml(content) {
  try {
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== 'object') {
      return { parsed: null, error: 'Invalid YAML: content must be an object' };
    }
    return { parsed, error: null };
  } catch (err) {
    return { parsed: null, error: `YAML syntax error: ${err.message}` };
  }
}

/**
 * Check if compose file has required structure
 * @param {object} parsed - Parsed compose object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateComposeStructure(parsed) {
  const errors = [];

  // Must have services section
  if (!parsed.services || typeof parsed.services !== 'object') {
    errors.push('Compose file must have a "services" section');
    return { valid: false, errors };
  }

  const serviceNames = Object.keys(parsed.services);
  
  if (serviceNames.length === 0) {
    errors.push('Compose file must define at least one service');
    return { valid: false, errors };
  }

  // For now, restrict to single service
  if (serviceNames.length > 1) {
    errors.push('Only single-service compose files are supported. Please create separate compose files for each service.');
    return { valid: false, errors };
  }

  // Validate each service has image or build
  for (const serviceName of serviceNames) {
    const service = parsed.services[serviceName];
    
    if (!service.image && !service.build) {
      errors.push(`Service "${serviceName}" must have either "image" or "build" defined`);
    }

    // Require container_name for GSM management
    if (!service.container_name) {
      errors.push(`Service "${serviceName}" must have a "container_name" defined for GSM management`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check compose content against security policies
 * @param {object} parsed - Parsed compose object
 * @returns {{ passed: boolean, errors: string[], warnings: string[] }}
 */
function checkSecurityPolicy(parsed) {
  const errors = [];
  const warnings = [];

  for (const [serviceName, service] of Object.entries(parsed.services || {})) {
    // Check for privileged mode
    if (service.privileged === true) {
      errors.push(`Service "${serviceName}": privileged mode is not allowed`);
    }

    // Check for host network mode
    if (service.network_mode === 'host') {
      errors.push(`Service "${serviceName}": host network mode is not allowed`);
    }

    // Check for host PID mode
    if (service.pid === 'host') {
      errors.push(`Service "${serviceName}": host PID mode is not allowed`);
    }

    // Check volume mounts
    if (service.volumes) {
      for (const volume of service.volumes) {
        const volumeStr = typeof volume === 'string' ? volume : volume.source || '';
        const hostPath = volumeStr.split(':')[0];

        for (const forbidden of FORBIDDEN_MOUNT_PATHS) {
          // Exact match or parent directory
          if (hostPath === forbidden || 
              (forbidden !== '/' && hostPath.startsWith(forbidden + '/'))) {
            errors.push(`Service "${serviceName}": mounting "${hostPath}" is not allowed for security reasons`);
            break;
          }
        }

        // Special case: exact root mount
        if (hostPath === '/') {
          errors.push(`Service "${serviceName}": mounting root filesystem "/" is not allowed`);
        }
      }
    }

    // Check capabilities (warning only)
    if (service.cap_add) {
      for (const cap of service.cap_add) {
        if (WARNED_CAPABILITIES.includes(cap)) {
          warnings.push(`Service "${serviceName}": capability "${cap}" added - this grants elevated permissions`);
        }
      }
    }

    // Check for security_opt that disables security
    if (service.security_opt) {
      for (const opt of service.security_opt) {
        if (opt.includes('apparmor:unconfined') || opt.includes('seccomp:unconfined')) {
          warnings.push(`Service "${serviceName}": security profiles disabled - container has reduced isolation`);
        }
      }
    }
  }

  return { 
    passed: errors.length === 0, 
    errors, 
    warnings 
  };
}

/**
 * Validate container name format and uniqueness
 * @param {object} parsed - Parsed compose object
 * @param {string[]} existingNames - Array of existing container names to check against
 * @returns {{ valid: boolean, errors: string[], containerName: string|null }}
 */
function validateContainerName(parsed, existingNames = []) {
  const errors = [];
  let containerName = null;

  const serviceNames = Object.keys(parsed.services || {});
  if (serviceNames.length > 0) {
    const service = parsed.services[serviceNames[0]];
    containerName = service.container_name;

    if (containerName) {
      // Validate format: alphanumeric, hyphens, underscores
      const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
      if (!validNameRegex.test(containerName)) {
        errors.push(`Container name "${containerName}" is invalid. Use only alphanumeric characters, hyphens, underscores, and periods.`);
      }

      // Check uniqueness
      if (existingNames.includes(containerName)) {
        errors.push(`Container name "${containerName}" is already in use`);
      }

      // Warn about length
      if (containerName.length > 63) {
        errors.push(`Container name "${containerName}" is too long (max 63 characters)`);
      }
    }
  }

  return { valid: errors.length === 0, errors, containerName };
}

/**
 * Validate compose file using Docker Compose CLI (dry-run)
 * @param {string} content - Raw YAML content
 * @returns {Promise<{ valid: boolean, error: string|null }>}
 */
async function validateWithDockerCompose(content) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gsm-compose-'));
  const tmpFile = path.join(tmpDir, 'docker-compose.yml');
  
  try {
    await fs.writeFile(tmpFile, content, 'utf8');
    
    // Use docker compose config to validate (v2 plugin style)
    await execPromise(`docker compose -f "${tmpFile}" config`, {
      timeout: 10000  // 10 second timeout
    });
    
    return { valid: true, error: null };
  } catch (err) {
    const errorMsg = err.stderr || err.message || 'Unknown validation error';
    return { valid: false, error: `Docker Compose validation failed: ${errorMsg}` };
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(tmpFile);
      await fs.rmdir(tmpDir);
    } catch (cleanupErr) {
      console.error('Error cleaning up temp files:', cleanupErr.message);
    }
  }
}

/**
 * Full validation pipeline for compose files
 * @param {string} content - Raw YAML content
 * @param {string[]} existingContainerNames - Array of existing container names
 * @param {boolean} skipDockerValidation - Skip Docker CLI validation (for faster checks)
 * @returns {Promise<{ valid: boolean, errors: string[], warnings: string[], containerName: string|null }>}
 */
async function validateComposeFile(content, existingContainerNames = [], skipDockerValidation = false) {
  const errors = [];
  const warnings = [];
  let containerName = null;

  // Step 1: Parse YAML
  const { parsed, error: parseError } = parseYaml(content);
  if (parseError) {
    return { valid: false, errors: [parseError], warnings: [], containerName: null };
  }

  // Step 2: Validate compose structure
  const structureResult = validateComposeStructure(parsed);
  errors.push(...structureResult.errors);

  if (!structureResult.valid) {
    return { valid: false, errors, warnings, containerName: null };
  }

  // Step 3: Security checks
  const securityResult = checkSecurityPolicy(parsed);
  errors.push(...securityResult.errors);
  warnings.push(...securityResult.warnings);

  // Step 4: Container name validation
  const nameResult = validateContainerName(parsed, existingContainerNames);
  errors.push(...nameResult.errors);
  containerName = nameResult.containerName;

  // Step 5: Docker Compose CLI validation (optional)
  if (!skipDockerValidation && errors.length === 0) {
    const dockerResult = await validateWithDockerCompose(content);
    if (!dockerResult.valid) {
      errors.push(dockerResult.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    containerName
  };
}

/**
 * Extract environment variables from compose content
 * @param {string} content - Raw YAML content
 * @returns {{ envVars: object|null, error: string|null }}
 */
function extractEnvironmentVariables(content) {
  const { parsed, error } = parseYaml(content);
  if (error) {
    return { envVars: null, error };
  }

  const envVars = {};
  const serviceNames = Object.keys(parsed.services || {});
  
  if (serviceNames.length > 0) {
    const service = parsed.services[serviceNames[0]];
    
    if (service.environment) {
      if (Array.isArray(service.environment)) {
        // Array format: ["VAR=value", "VAR2=value2"]
        for (const env of service.environment) {
          const [key, ...valueParts] = env.split('=');
          envVars[key] = valueParts.join('=');
        }
      } else {
        // Object format: { VAR: value, VAR2: value2 }
        Object.assign(envVars, service.environment);
      }
    }
  }

  return { envVars, error: null };
}

/**
 * Update environment variables in compose content
 * @param {string} content - Raw YAML content
 * @param {object} newEnvVars - New environment variables
 * @returns {{ content: string|null, error: string|null }}
 */
function updateEnvironmentVariables(content, newEnvVars) {
  const { parsed, error } = parseYaml(content);
  if (error) {
    return { content: null, error };
  }

  const serviceNames = Object.keys(parsed.services || {});
  if (serviceNames.length > 0) {
    const serviceName = serviceNames[0];
    
    // Merge with existing environment, preferring new values
    const existingEnv = parsed.services[serviceName].environment || {};
    let mergedEnv;
    
    if (Array.isArray(existingEnv)) {
      // Convert array to object for merging
      const envObj = {};
      for (const env of existingEnv) {
        const [key, ...valueParts] = env.split('=');
        envObj[key] = valueParts.join('=');
      }
      mergedEnv = { ...envObj, ...newEnvVars };
    } else {
      mergedEnv = { ...existingEnv, ...newEnvVars };
    }
    
    parsed.services[serviceName].environment = mergedEnv;
  }

  try {
    const updatedContent = yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,  // Don't wrap lines
      quotingType: '"',
      forceQuotes: false
    });
    return { content: updatedContent, error: null };
  } catch (err) {
    return { content: null, error: `Failed to serialize YAML: ${err.message}` };
  }
}

module.exports = {
  parseYaml,
  validateComposeStructure,
  checkSecurityPolicy,
  validateContainerName,
  validateWithDockerCompose,
  validateComposeFile,
  extractEnvironmentVariables,
  updateEnvironmentVariables,
  FORBIDDEN_MOUNT_PATHS,
  WARNED_CAPABILITIES
};
