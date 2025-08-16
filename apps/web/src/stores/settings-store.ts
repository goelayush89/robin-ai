import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Browser-compatible type definitions
export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  CUSTOM = 'custom',
  LOCAL = 'local'
}

export enum OperatorType {
  LOCAL_COMPUTER = 'local_computer',
  WEB_BROWSER = 'web_browser',
  HYBRID = 'hybrid'
}

export interface ModelSettings {
  provider: ModelProvider;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}

export interface OperatorSettings {
  type: OperatorType;
  headless: boolean;
  width: number;
  height: number;
  userAgent?: string;
  executablePath?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  maxIterations: number;
  iterationDelay: number;
  autoScreenshot: boolean;
  confirmActions: boolean;
  telemetry: boolean;
  debugMode: boolean;
}

// Extended settings interfaces for the new settings page
export interface ExtendedModelSettings {
  provider?: ModelProvider | string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  name?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentSettings {
  maxIterations?: number;
  iterationDelay?: number;
  autoScreenshot?: boolean;
  confirmActions?: boolean;
  debugMode?: boolean;
}

export interface AppearanceSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  animations?: boolean;
  compactMode?: boolean;
}

export interface SecuritySettings {
  encryptLocalData?: boolean;
  autoLock?: boolean;
  telemetry?: boolean;
}

export interface AdvancedSettings {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  maxConcurrentAgents?: number;
  developerMode?: boolean;
  experimentalFeatures?: boolean;
}

export interface Settings {
  model?: ExtendedModelSettings;
  agent?: AgentSettings;
  appearance?: AppearanceSettings;
  security?: SecuritySettings;
  advanced?: AdvancedSettings;
  apiKeys?: Record<string, string>;
}

export interface SettingsStore {
  // Legacy settings (for backward compatibility)
  modelSettings: ModelSettings;
  operatorSettings: OperatorSettings;
  appSettings: AppSettings;

  // New unified settings
  settings: Settings;

  // Legacy actions
  updateModelSettings: (settings: Partial<ModelSettings>) => void;
  updateOperatorSettings: (settings: Partial<OperatorSettings>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  resetToDefaults: () => void;

  // New settings actions
  updateSettings: (newSettings: Partial<Settings>) => void;
  testConnection: (providerId: string) => Promise<boolean>;
  exportSettings: () => void;
  importSettings: (settings: Settings) => void;

  // Getters
  getAgentConfig: () => any;
}

const defaultModelSettings: ModelSettings = {
  provider: ModelProvider.ANTHROPIC,
  apiKey: '',
  baseUrl: '',
  modelName: 'claude-3-5-sonnet-20241022'
};

const defaultOperatorSettings: OperatorSettings = {
  type: OperatorType.LOCAL_COMPUTER,
  headless: false,
  width: 1920,
  height: 1080,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const defaultAppSettings: AppSettings = {
  theme: 'system',
  language: 'en',
  maxIterations: 10,
  iterationDelay: 1000,
  autoScreenshot: true,
  confirmActions: false,
  telemetry: false,
  debugMode: false
};

// New unified default settings
const defaultSettings: Settings = {
  model: {
    provider: ModelProvider.ANTHROPIC,
    apiKey: '',
    baseUrl: '',
    modelName: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4000
  },
  agent: {
    maxIterations: 10,
    iterationDelay: 1000,
    autoScreenshot: true,
    confirmActions: false,
    debugMode: false
  },
  appearance: {
    theme: 'system',
    language: 'en',
    animations: true,
    compactMode: false
  },
  security: {
    encryptLocalData: true,
    autoLock: false,
    telemetry: false
  },
  advanced: {
    logLevel: 'info',
    maxConcurrentAgents: 3,
    developerMode: false,
    experimentalFeatures: false
  },
  apiKeys: {}
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      modelSettings: defaultModelSettings,
      operatorSettings: defaultOperatorSettings,
      appSettings: defaultAppSettings,
      settings: defaultSettings,

      // Legacy actions
      updateModelSettings: (settings: Partial<ModelSettings>) => {
        set(state => ({
          modelSettings: { ...state.modelSettings, ...settings }
        }));
      },

      updateOperatorSettings: (settings: Partial<OperatorSettings>) => {
        set(state => ({
          operatorSettings: { ...state.operatorSettings, ...settings }
        }));
      },

      updateAppSettings: (settings: Partial<AppSettings>) => {
        set(state => ({
          appSettings: { ...state.appSettings, ...settings }
        }));
      },

      resetToDefaults: () => {
        set({
          modelSettings: defaultModelSettings,
          operatorSettings: defaultOperatorSettings,
          appSettings: defaultAppSettings,
          settings: defaultSettings
        });
      },

      // New settings actions
      updateSettings: (newSettings: Partial<Settings>) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },

      testConnection: async (providerId: string) => {
        const { settings } = get();
        const apiKey = settings.apiKeys?.[providerId];

        if (!apiKey && providerId !== 'ollama') {
          return false;
        }

        try {
          // Mock API test - in real implementation, this would test the actual API
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Simulate different success rates for demo
          const successRate = providerId === 'ollama' ? 0.7 : 0.9;
          return Math.random() < successRate;
        } catch (error) {
          console.error('Connection test failed:', error);
          return false;
        }
      },

      exportSettings: () => {
        const { settings } = get();
        const sanitizedSettings = { ...settings };

        // Remove sensitive data
        if (sanitizedSettings.apiKeys) {
          sanitizedSettings.apiKeys = Object.keys(sanitizedSettings.apiKeys).reduce((acc, key) => {
            acc[key] = '[REDACTED]';
            return acc;
          }, {} as Record<string, string>);
        }

        const dataStr = JSON.stringify(sanitizedSettings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `robin-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      importSettings: (newSettings: Settings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },

      // Getters
      getAgentConfig: () => {
        const state = get();
        return {
          id: 'robin-agent',
          name: 'Robin Assistant',
          model: {
            provider: state.modelSettings.provider,
            name: state.modelSettings.modelName,
            apiKey: state.modelSettings.apiKey,
            baseUrl: state.modelSettings.baseUrl,
            version: '1.0'
          },
          operator: {
            type: state.operatorSettings.type,
            settings: {
              headless: state.operatorSettings.headless,
              width: state.operatorSettings.width,
              height: state.operatorSettings.height,
              userAgent: state.operatorSettings.userAgent,
              executablePath: state.operatorSettings.executablePath
            }
          },
          settings: {
            maxIterations: state.appSettings.maxIterations,
            iterationDelay: state.appSettings.iterationDelay,
            autoScreenshot: state.appSettings.autoScreenshot,
            confirmActions: state.appSettings.confirmActions,
            language: state.appSettings.language
          }
        };
      }
    }),
    {
      name: 'robin-settings-store'
    }
  )
);
