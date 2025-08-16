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

export interface SettingsStore {
  // Settings
  modelSettings: ModelSettings;
  operatorSettings: OperatorSettings;
  appSettings: AppSettings;
  
  // Actions
  updateModelSettings: (settings: Partial<ModelSettings>) => void;
  updateOperatorSettings: (settings: Partial<OperatorSettings>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
  
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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      modelSettings: defaultModelSettings,
      operatorSettings: defaultOperatorSettings,
      appSettings: defaultAppSettings,

      // Actions
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
          appSettings: defaultAppSettings
        });
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
