import Store from 'electron-store';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import { SecurityManager } from './security-manager';

export interface ModelSettings {
  provider: 'openai' | 'anthropic' | 'custom' | 'local';
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OperatorSettings {
  type: 'local_computer' | 'web_browser' | 'hybrid';
  headless: boolean;
  width: number;
  height: number;
  userAgent?: string;
  executablePath?: string;
  timeout: number;
}

export interface GeneralSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoStart: boolean;
  minimizeToTray: boolean;
  notifications: boolean;
  telemetry: boolean;
  debugMode: boolean;
}

export interface AgentSettings {
  model: ModelSettings;
  operator: OperatorSettings;
  maxIterations: number;
  iterationDelay: number;
  autoScreenshot: boolean;
  confirmActions: boolean;
  general: GeneralSettings;
}

export interface Session {
  id: string;
  name: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
  agentType?: string;
  metadata?: Record<string, any>;
}

export interface AppSettings {
  agent: AgentSettings;
  security: any;
  ui: any;
  [key: string]: any;
}

export class SettingsManager {
  private store: Store;
  private securityManager: SecurityManager;
  private encryptedKeys = ['agent.model.apiKey', 'security.credentials'];

  constructor(store: Store, securityManager: SecurityManager) {
    this.store = store;
    this.securityManager = securityManager;
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    const defaults: AppSettings = {
      agent: {
        model: {
          provider: 'anthropic',
          apiKey: '',
          modelName: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          maxTokens: 4000
        },
        operator: {
          type: 'hybrid',
          headless: false,
          width: 1920,
          height: 1080,
          timeout: 30000
        },
        maxIterations: 10,
        iterationDelay: 1000,
        autoScreenshot: true,
        confirmActions: false,
        general: {
          theme: 'system',
          language: 'en',
          autoStart: false,
          minimizeToTray: true,
          notifications: true,
          telemetry: false,
          debugMode: false
        }
      },
      security: {
        encryptionEnabled: true,
        sessionTimeout: 30 * 60 * 1000,
        requireAuth: false
      },
      ui: {
        sidebarCollapsed: false,
        windowBounds: {
          width: 1200,
          height: 800
        }
      }
    };

    // Set defaults if not already set
    Object.keys(defaults).forEach(key => {
      if (!this.store.has(key)) {
        this.store.set(key, defaults[key as keyof AppSettings]);
      }
    });
  }

  async getSettings(category?: string): Promise<any> {
    try {
      let settings: any;

      if (category) {
        settings = this.store.get(category, {});
      } else {
        settings = this.store.store;
      }

      // Decrypt sensitive data
      settings = await this.decryptSensitiveData(settings, category);

      return settings;
    } catch (error) {
      log.error('Failed to get settings:', error);
      throw error;
    }
  }

  async setSettings(category: string, settings: any): Promise<void> {
    try {
      // Encrypt sensitive data before storing
      const encryptedSettings = await this.encryptSensitiveData(settings, category);
      
      this.store.set(category, encryptedSettings);
      log.info(`Settings updated for category: ${category}`);
    } catch (error) {
      log.error('Failed to set settings:', error);
      throw error;
    }
  }

  async updateSetting(key: string, value: any): Promise<void> {
    try {
      // Check if this is a sensitive key that needs encryption
      if (this.isSensitiveKey(key)) {
        value = await this.securityManager.encryptData(JSON.stringify(value));
      }
      
      this.store.set(key, value);
      log.info(`Setting updated: ${key}`);
    } catch (error) {
      log.error('Failed to update setting:', error);
      throw error;
    }
  }

  async getSetting(key: string, defaultValue?: any): Promise<any> {
    try {
      let value = this.store.get(key, defaultValue);
      
      // Decrypt if sensitive
      if (this.isSensitiveKey(key) && value && typeof value === 'string') {
        const decrypted = await this.securityManager.decryptData(value);
        value = JSON.parse(decrypted);
      }
      
      return value;
    } catch (error) {
      log.error('Failed to get setting:', error);
      return defaultValue;
    }
  }

  async resetSettings(category?: string): Promise<void> {
    try {
      if (category) {
        this.store.delete(category);
      } else {
        this.store.clear();
      }
      
      this.initializeDefaults();
      log.info(`Settings reset for category: ${category || 'all'}`);
    } catch (error) {
      log.error('Failed to reset settings:', error);
      throw error;
    }
  }

  // Session management
  async createSession(data: { name?: string; agentType?: string }): Promise<Session> {
    try {
      const session: Session = {
        id: uuidv4(),
        name: data.name || `Session ${new Date().toLocaleString()}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agentType: data.agentType,
        metadata: {}
      };

      const sessions = await this.getSessions();
      sessions.push(session);
      await this.setSessions(sessions);

      log.info(`Session created: ${session.id}`);
      return session;
    } catch (error) {
      log.error('Failed to create session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const sessions = await this.getSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      log.error('Failed to get session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) {
        throw new Error(`Session ${sessionId} not found`);
      }

      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        ...updates,
        updatedAt: Date.now()
      };

      await this.setSessions(sessions);
      log.info(`Session updated: ${sessionId}`);
    } catch (error) {
      log.error('Failed to update session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      await this.setSessions(filteredSessions);
      log.info(`Session deleted: ${sessionId}`);
    } catch (error) {
      log.error('Failed to delete session:', error);
      throw error;
    }
  }

  async listSessions(): Promise<Session[]> {
    return this.getSessions();
  }

  private async getSessions(): Promise<Session[]> {
    return this.store.get('sessions', []) as Session[];
  }

  private async setSessions(sessions: Session[]): Promise<void> {
    this.store.set('sessions', sessions);
  }

  // Credential management
  async storeCredentials(provider: string, credentials: Record<string, any>): Promise<void> {
    try {
      const encryptedCredentials = await this.securityManager.encryptCredentials(credentials);
      const credentialsStore = this.store.get('security.credentials', {}) as Record<string, string>;
      
      credentialsStore[provider] = encryptedCredentials;
      this.store.set('security.credentials', credentialsStore);
      
      log.info(`Credentials stored for provider: ${provider}`);
    } catch (error) {
      log.error('Failed to store credentials:', error);
      throw error;
    }
  }

  async getCredentials(provider: string): Promise<Record<string, any> | null> {
    try {
      const credentialsStore = this.store.get('security.credentials', {}) as Record<string, string>;
      const encryptedCredentials = credentialsStore[provider];
      
      if (!encryptedCredentials) {
        return null;
      }

      return await this.securityManager.decryptCredentials(encryptedCredentials);
    } catch (error) {
      log.error('Failed to get credentials:', error);
      return null;
    }
  }

  async deleteCredentials(provider: string): Promise<void> {
    try {
      const credentialsStore = this.store.get('security.credentials', {}) as Record<string, string>;
      delete credentialsStore[provider];
      this.store.set('security.credentials', credentialsStore);
      
      log.info(`Credentials deleted for provider: ${provider}`);
    } catch (error) {
      log.error('Failed to delete credentials:', error);
      throw error;
    }
  }

  // Utility methods
  private isSensitiveKey(key: string): boolean {
    return this.encryptedKeys.some(encryptedKey => key.includes(encryptedKey));
  }

  private async encryptSensitiveData(data: any, category?: string): Promise<any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const encrypted = { ...data };

    // Encrypt API keys and other sensitive data
    if (category === 'agent' && encrypted.model && encrypted.model.apiKey) {
      encrypted.model.apiKey = await this.securityManager.encryptData(encrypted.model.apiKey);
    }

    return encrypted;
  }

  private async decryptSensitiveData(data: any, category?: string): Promise<any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const decrypted = { ...data };

    // Decrypt API keys and other sensitive data
    if (category === 'agent' && decrypted.model && decrypted.model.apiKey) {
      try {
        decrypted.model.apiKey = await this.securityManager.decryptData(decrypted.model.apiKey);
      } catch (error) {
        log.warn('Failed to decrypt API key, using empty string');
        decrypted.model.apiKey = '';
      }
    }

    return decrypted;
  }

  saveSettings(): void {
    // Force save to disk
    this.store.store = this.store.store;
    log.info('Settings saved to disk');
  }

  getStorePath(): string {
    return this.store.path;
  }

  exportSettings(): any {
    const settings = { ...this.store.store };

    // Remove sensitive data from export
    if (settings.security && (settings.security as any).credentials) {
      delete (settings.security as any).credentials;
    }

    if (settings.agent && (settings.agent as any).model && (settings.agent as any).model.apiKey) {
      (settings.agent as any).model.apiKey = '[REDACTED]';
    }

    return settings;
  }

  async importSettings(settings: any): Promise<void> {
    try {
      // Validate settings structure
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings format');
      }

      // Merge with existing settings
      const currentSettings = this.store.store;
      const mergedSettings = { ...currentSettings, ...settings };

      // Don't import sensitive data
      if (mergedSettings.security?.credentials) {
        delete mergedSettings.security.credentials;
      }

      this.store.store = mergedSettings;
      log.info('Settings imported successfully');
    } catch (error) {
      log.error('Failed to import settings:', error);
      throw error;
    }
  }
}
