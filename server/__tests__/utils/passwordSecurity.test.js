const axios = require('axios');
const passwordSecurity = require('../../utils/passwordSecurity');

// Mock axios
jest.mock('axios');

describe('PasswordSecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSHA1Hash', () => {
    it('should generate correct SHA-1 hash in uppercase', () => {
      const hash = passwordSecurity.generateSHA1Hash('password123');
      expect(hash).toBe('CBFDAC6008F9CAB4083784CBD1874F76618D2A97');
    });

    it('should handle empty string', () => {
      const hash = passwordSecurity.generateSHA1Hash('');
      expect(hash).toBe('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
    });

    it('should handle special characters', () => {
      const hash = passwordSecurity.generateSHA1Hash('p@ssw0rd!#$');
      expect(hash).toMatch(/^[A-F0-9]{40}$/); // Valid SHA-1 format
    });
  });

  describe('parseAPIResponse', () => {
    it('should find matching hash suffix', () => {
      const apiResponse = 'ABC123:5\nDEF456:10\nGHI789:2';
      const result = passwordSecurity.parseAPIResponse(apiResponse, 'DEF456');
      
      expect(result.isPwned).toBe(true);
      expect(result.count).toBe(10);
    });

    it('should return not pwned for non-matching suffix', () => {
      const apiResponse = 'ABC123:5\nDEF456:10';
      const result = passwordSecurity.parseAPIResponse(apiResponse, 'XYZ999');
      
      expect(result.isPwned).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle empty API response', () => {
      const result = passwordSecurity.parseAPIResponse('', 'ABC123');
      
      expect(result.isPwned).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe('checkPassword', () => {
    it('should return pwned result for compromised password', async () => {
      // Mock API response for a known compromised password
      // password123 hash: CBFDAC6008F9CAB4083784CBD1874F76618D2A97
      // Prefix: CBFDA, Suffix: C6008F9CAB4083784CBD1874F76618D2A97
      axios.get.mockResolvedValue({
        data: 'C6008F9CAB4083784CBD1874F76618D2A97:1000\nOTHERHASH:50'
      });

      const result = await passwordSecurity.checkPassword('password123');
      
      expect(result.isPwned).toBe(true);
      expect(result.count).toBe(1000);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://api.pwnedpasswords.com/range/'),
        expect.objectContaining({
          headers: { 'User-Agent': 'Game-Server-Manager/1.0' },
          timeout: 5000
        })
      );
    });

    it('should return not pwned for secure password', async () => {
      // Mock API response without our hash
      axios.get.mockResolvedValue({
        data: 'ABCDEF:100\nGHIJKL:200'
      });

      const result = await passwordSecurity.checkPassword('verySecureP@ssw0rd!2024');
      
      expect(result.isPwned).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      // Mock API failure
      axios.get.mockRejectedValue(new Error('Network error'));

      const result = await passwordSecurity.checkPassword('anypassword');
      
      expect(result.isPwned).toBe(false);
      expect(result.count).toBe(0);
      expect(result.error).toBe('Password security service temporarily unavailable');
    });

    it('should handle API timeout', async () => {
      axios.get.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

      const result = await passwordSecurity.checkPassword('testpassword');
      
      expect(result.isPwned).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSecurityMessage', () => {
    it('should return safe message for count 0', () => {
      const message = passwordSecurity.getSecurityMessage(0);
      expect(message).toContain('not been found');
    });

    it('should return warning for low count (1-9)', () => {
      const message = passwordSecurity.getSecurityMessage(5);
      expect(message).toContain('5 time(s)');
      expect(message).toContain('Consider');
    });

    it('should return strong warning for medium count (10-99)', () => {
      const message = passwordSecurity.getSecurityMessage(50);
      expect(message).toContain('50 times');
      expect(message).toContain('strongly recommend');
    });

    it('should return critical warning for high count (100+)', () => {
      const message = passwordSecurity.getSecurityMessage(1000);
      expect(message).toContain('1000 times');
      expect(message).toContain('very insecure');
    });
  });

  describe('shouldBlockPassword', () => {
    it('should not block passwords with count <= 10', () => {
      expect(passwordSecurity.shouldBlockPassword(0)).toBe(false);
      expect(passwordSecurity.shouldBlockPassword(5)).toBe(false);
      expect(passwordSecurity.shouldBlockPassword(10)).toBe(false);
    });

    it('should block passwords with count > 10', () => {
      expect(passwordSecurity.shouldBlockPassword(11)).toBe(true);
      expect(passwordSecurity.shouldBlockPassword(100)).toBe(true);
      expect(passwordSecurity.shouldBlockPassword(10000)).toBe(true);
    });
  });
});
