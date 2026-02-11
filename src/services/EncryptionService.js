/**
 * Encryption Service
 * Handles secure encryption/decryption of sensitive data (API keys)
 */

import crypto from 'crypto';
import { ENCRYPTION } from '../config/constants.js';

class EncryptionService {
  constructor() {
    // Ensure key is exactly 32 bytes for AES-256
    this.key = Buffer.from(ENCRYPTION.KEY.padEnd(32, '!').slice(0, 32));
    this.algorithm = ENCRYPTION.ALGORITHM;
  }

  /**
   * Encrypt text
   * @param {string} text - Plain text to encrypt
   * @returns {string} - Encrypted text (base64 with IV)
   */
  encrypt(text) {
    try {
      // Generate random IV (16 bytes for AES)
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get auth tag (for GCM mode)
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const result = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
      ]).toString('base64');
      
      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt text
   * @param {string} encryptedData - Encrypted text (base64 with IV)
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedData) {
    try {
      // Decode from base64
      const data = Buffer.from(encryptedData, 'base64');
      
      // Extract IV (first 16 bytes)
      const iv = data.slice(0, 16);
      
      // Extract auth tag (next 16 bytes for GCM)
      const authTag = data.slice(16, 32);
      
      // Extract encrypted content
      const encrypted = data.slice(32).toString('base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a value (for tokens, etc)
   * @param {string} value - Value to hash
   * @returns {string} - SHA-256 hash
   */
  hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a secure random token
   * @param {number} length - Length in bytes
   * @returns {string} - Hex string
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export singleton instance
export const encryption = new EncryptionService();
export default encryption;
