import { safeStorage } from 'electron';
import * as crypto from 'crypto';
import log from 'electron-log';

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
}

export interface SecuritySettings {
  encryptionEnabled: boolean;
  sessionTimeout: number;
  requireAuth: boolean;
  biometricAuth: boolean;
}

export class SecurityManager {
  private machineId: string;
  private encryptionKey: Buffer | null = null;
  private isInitialized = false;

  constructor(machineId: string) {
    this.machineId = machineId;
    this.initialize();
  }

  private initialize(): void {
    try {
      // Check if safe storage is available
      if (safeStorage.isEncryptionAvailable()) {
        log.info('Safe storage encryption is available');
        this.isInitialized = true;
      } else {
        log.warn('Safe storage encryption is not available, using fallback encryption');
        this.initializeFallbackEncryption();
      }
    } catch (error) {
      log.error('Failed to initialize security manager:', error);
      this.initializeFallbackEncryption();
    }
  }

  private initializeFallbackEncryption(): void {
    // Create encryption key from machine ID
    const hash = crypto.createHash('sha256');
    hash.update(this.machineId);
    hash.update('robin-assistant-encryption-key');
    this.encryptionKey = hash.digest();
    this.isInitialized = true;
  }

  async encryptData(data: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Security manager not initialized');
    }

    try {
      // Use Electron's safe storage if available
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(data);
        return encrypted.toString('base64');
      }

      // Fallback to custom encryption
      return this.encryptWithFallback(data);
    } catch (error) {
      log.error('Failed to encrypt data:', error);
      throw new Error('Encryption failed');
    }
  }

  async decryptData(encryptedData: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Security manager not initialized');
    }

    try {
      // Use Electron's safe storage if available
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encryptedData, 'base64');
        return safeStorage.decryptString(buffer);
      }

      // Fallback to custom decryption
      return this.decryptWithFallback(encryptedData);
    } catch (error) {
      log.error('Failed to decrypt data:', error);
      throw new Error('Decryption failed');
    }
  }

  private encryptWithFallback(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    
    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 10000, 32, 'sha256');
    
    // Encrypt data
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const result: EncryptedData = {
      data: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex')
    };

    // Combine everything
    const combined = JSON.stringify(result);
    return Buffer.from(combined).toString('base64');
  }

  private decryptWithFallback(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      const combined = Buffer.from(encryptedData, 'base64').toString();
      const data: EncryptedData = JSON.parse(combined);

      const salt = Buffer.from(data.salt, 'hex');
      const iv = Buffer.from(data.iv, 'hex');

      // Derive key using PBKDF2
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 10000, 32, 'sha256');

      // Decrypt data
      const decipher = crypto.createDecipher('aes-256-cbc', key);

      let decrypted = decipher.update(data.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      log.error('Fallback decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  async encryptCredentials(credentials: Record<string, any>): Promise<string> {
    const credentialsJson = JSON.stringify(credentials);
    return this.encryptData(credentialsJson);
  }

  async decryptCredentials(encryptedCredentials: string): Promise<Record<string, any>> {
    const credentialsJson = await this.decryptData(encryptedCredentials);
    return JSON.parse(credentialsJson);
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha256').toString('hex');
    return { hash, salt: actualSalt };
  }

  verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input.replace(/[<>\"'&]/g, '');
  }

  validateApiKey(apiKey: string): boolean {
    // Basic API key validation
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check length (most API keys are at least 20 characters)
    if (apiKey.length < 20) {
      return false;
    }

    // Check for common patterns
    const patterns = [
      /^sk-[a-zA-Z0-9]{48}$/, // OpenAI pattern
      /^[a-zA-Z0-9_-]{20,}$/, // Generic pattern
    ];

    return patterns.some(pattern => pattern.test(apiKey));
  }

  async secureDelete(data: string): Promise<void> {
    // Overwrite memory with random data multiple times
    const buffer = Buffer.from(data);
    for (let i = 0; i < 3; i++) {
      crypto.randomFillSync(buffer);
    }
    buffer.fill(0);
  }

  getSecuritySettings(): SecuritySettings {
    return {
      encryptionEnabled: this.isInitialized,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      requireAuth: false,
      biometricAuth: false
    };
  }

  isSecureContext(): boolean {
    return this.isInitialized && (safeStorage.isEncryptionAvailable() || this.encryptionKey !== null);
  }

  generateCSRFToken(): string {
    return this.generateSecureToken(16);
  }

  validateCSRFToken(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }

  // Rate limiting for API calls
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  clearRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
  }

  // Cleanup sensitive data from memory
  cleanup(): void {
    if (this.encryptionKey) {
      crypto.randomFillSync(this.encryptionKey);
      this.encryptionKey = null;
    }
    this.rateLimitMap.clear();
    log.info('Security manager cleaned up');
  }
}
