const composeValidator = require('../../utils/composeValidator');

describe('composeValidator', () => {
  describe('parseYaml', () => {
    it('should parse valid YAML', () => {
      const yaml = `
services:
  test:
    image: nginx
    container_name: test-container
`;
      const result = composeValidator.parseYaml(yaml);
      expect(result.error).toBeNull();
      expect(result.parsed).toBeDefined();
      expect(result.parsed.services.test.image).toBe('nginx');
    });

    it('should return error for invalid YAML', () => {
      const yaml = `
services:
  test:
    image: nginx
  invalid indentation
`;
      const result = composeValidator.parseYaml(yaml);
      expect(result.error).not.toBeNull();
      expect(result.parsed).toBeNull();
    });
  });

  describe('validateComposeStructure', () => {
    it('should validate compose with services', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test-container'
          }
        }
      };
      const result = composeValidator.validateComposeStructure(parsed);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject compose without services', () => {
      const parsed = { version: '3' };
      const result = composeValidator.validateComposeStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Compose file must have a "services" section');
    });

    it('should reject service without image or build', () => {
      const parsed = {
        services: {
          test: {
            container_name: 'test-container'
          }
        }
      };
      const result = composeValidator.validateComposeStructure(parsed);
      expect(result.valid).toBe(false);
    });

    it('should reject service without container_name', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx'
          }
        }
      };
      const result = composeValidator.validateComposeStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('container_name'))).toBe(true);
    });

    it('should reject multi-service compose files', () => {
      const parsed = {
        services: {
          service1: { image: 'nginx', container_name: 'service1' },
          service2: { image: 'redis', container_name: 'service2' }
        }
      };
      const result = composeValidator.validateComposeStructure(parsed);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('single-service'))).toBe(true);
    });
  });

  describe('checkSecurityPolicy', () => {
    it('should reject privileged containers', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            privileged: true
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('privileged'))).toBe(true);
    });

    it('should reject host network mode', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            network_mode: 'host'
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('host network'))).toBe(true);
    });

    it('should reject docker socket mount', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            volumes: ['/var/run/docker.sock:/var/run/docker.sock']
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('/var/run/docker.sock'))).toBe(true);
    });

    it('should reject root filesystem mount', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            volumes: ['/:/host']
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('root filesystem'))).toBe(true);
    });

    it('should warn about dangerous capabilities', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            cap_add: ['SYS_ADMIN']
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(true);  // Passes but with warnings
      expect(result.warnings.some(w => w.includes('SYS_ADMIN'))).toBe(true);
    });

    it('should allow safe configurations', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'test',
            volumes: ['/var/opt/container-volumes/test:/data'],
            ports: ['8080:80']
          }
        }
      };
      const result = composeValidator.checkSecurityPolicy(parsed);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateContainerName', () => {
    it('should accept valid container names', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'my-game-server'
          }
        }
      };
      const result = composeValidator.validateContainerName(parsed, []);
      expect(result.valid).toBe(true);
      expect(result.containerName).toBe('my-game-server');
    });

    it('should reject duplicate container names', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'existing-server'
          }
        }
      };
      const result = composeValidator.validateContainerName(parsed, ['existing-server']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('already in use'))).toBe(true);
    });

    it('should reject invalid container name characters', () => {
      const parsed = {
        services: {
          test: {
            image: 'nginx',
            container_name: 'invalid name!'
          }
        }
      };
      const result = composeValidator.validateContainerName(parsed, []);
      expect(result.valid).toBe(false);
    });
  });

  describe('extractEnvironmentVariables', () => {
    it('should extract object-style environment variables', () => {
      const content = `
services:
  test:
    image: nginx
    container_name: test
    environment:
      VAR1: value1
      VAR2: value2
`;
      const result = composeValidator.extractEnvironmentVariables(content);
      expect(result.error).toBeNull();
      expect(result.envVars.VAR1).toBe('value1');
      expect(result.envVars.VAR2).toBe('value2');
    });

    it('should extract array-style environment variables', () => {
      const content = `
services:
  test:
    image: nginx
    container_name: test
    environment:
      - VAR1=value1
      - VAR2=value2
`;
      const result = composeValidator.extractEnvironmentVariables(content);
      expect(result.error).toBeNull();
      expect(result.envVars.VAR1).toBe('value1');
      expect(result.envVars.VAR2).toBe('value2');
    });
  });

  describe('updateEnvironmentVariables', () => {
    it('should update environment variables', () => {
      const content = `
services:
  test:
    image: nginx
    container_name: test
    environment:
      VAR1: oldvalue
`;
      const result = composeValidator.updateEnvironmentVariables(content, { VAR1: 'newvalue', VAR2: 'added' });
      expect(result.error).toBeNull();
      expect(result.content).toContain('newvalue');
      expect(result.content).toContain('VAR2');
    });
  });
});
