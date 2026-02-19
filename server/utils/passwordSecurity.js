const axios = require('axios');
const crypto = require('crypto');

/**
 * HaveIBeenPwned Password Security Service
 * Uses the k-anonymity model to check passwords against the HIBP database
 * without sending the full password hash to the API
 */
class PasswordSecurityService {
  constructor() {
    this.apiBaseUrl = 'https://api.pwnedpasswords.com/range';
    this.userAgent = 'Game-Server-Manager/1.0';
  }

  /**
   * Check if a password has been found in known data breaches
   * @param {string} password - The password to check
   * @returns {Promise<{isPwned: boolean, count: number}>} - Result object
   */
  async checkPassword(password) {
    try {
      // Generate SHA-1 hash of the password
      const hash = this.generateSHA1Hash(password);
      
      // Get first 5 characters for k-anonymity search
      const hashPrefix = hash.substring(0, 5);
      const hashSuffix = hash.substring(5);

      // Query the HIBP API
      const response = await this.queryHIBPAPI(hashPrefix);
      
      // Check if our hash suffix appears in the results
      const result = this.parseAPIResponse(response, hashSuffix);
      
      return result;
    } catch (error) {
      console.error('Error checking password against HIBP:', error.message);
      // If the service is unavailable, don't block the user
      // but log the error for monitoring
      return {
        isPwned: false,
        count: 0,
        error: 'Password security service temporarily unavailable'
      };
    }
  }

  /**
   * Generate SHA-1 hash of the password (uppercase)
   * @param {string} password - The password to hash
   * @returns {string} - SHA-1 hash in uppercase
   */
  generateSHA1Hash(password) {
    // SHA-1 is required by the HIBP k-anonymity range API protocol.
    // Stored user passwords are hashed separately with bcrypt in the User model.
    return crypto
      .createHash('sha1')
      .update(password, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Query the HIBP API with hash prefix
   * @param {string} hashPrefix - First 5 characters of SHA-1 hash
   * @returns {Promise<string>} - API response data
   */
  async queryHIBPAPI(hashPrefix) {
    const response = await axios.get(`${this.apiBaseUrl}/${hashPrefix}`, {
      headers: {
        'User-Agent': this.userAgent
      },
      timeout: 5000 // 5 second timeout
    });

    return response.data;
  }

  /**
   * Parse API response to find if our hash suffix exists
   * @param {string} apiResponse - Raw API response
   * @param {string} hashSuffix - Our hash suffix to search for
   * @returns {object} - {isPwned: boolean, count: number}
   */
  parseAPIResponse(apiResponse, hashSuffix) {
    const lines = apiResponse.split('\n');
    
    for (const line of lines) {
      const [suffix, count] = line.split(':');
      if (suffix === hashSuffix) {
        return {
          isPwned: true,
          count: parseInt(count, 10)
        };
      }
    }

    return {
      isPwned: false,
      count: 0
    };
  }

  /**
   * Get a user-friendly message based on the breach count
   * @param {number} count - Number of times password was found in breaches
   * @returns {string} - User-friendly message
   */
  getSecurityMessage(count) {
    if (count === 0) {
      return 'This password has not been found in known data breaches.';
    } else if (count < 10) {
      return `This password has been found ${count} time(s) in data breaches. Consider using a different password.`;
    } else if (count < 100) {
      return `This password has been found ${count} times in data breaches. We strongly recommend choosing a different password.`;
    } else {
      return `This password has been found ${count} times in data breaches. This password is very insecure - please choose a different one.`;
    }
  }

  /**
   * Determine if a password should be blocked based on breach count
   * @param {number} count - Number of times password was found in breaches
   * @returns {boolean} - Whether to block the password
   */
  shouldBlockPassword(count) {
    // Block passwords that have been seen more than 10 times in breaches
    // This is a reasonable threshold that blocks very common passwords
    // while allowing some flexibility for users
    return count > 10;
  }
}

module.exports = new PasswordSecurityService();
