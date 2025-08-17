import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// IPC types (standalone to avoid dependency issues)
export interface IPCRequest<T = any> {
  id: string;
  timestamp: number;
  data?: T;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// IPC Channel enum
export enum IPCChannel {
  // Agent control
  AGENT_START = 'agent:start',
  AGENT_PAUSE = 'agent:pause',
  AGENT_RESUME = 'agent:resume',
  AGENT_STOP = 'agent:stop',
  AGENT_STATUS = 'agent:status',

  // Screenshot
  SCREENSHOT_TAKE = 'screenshot:take',
  SCREENSHOT_REGION = 'screenshot:region',
  SCREENSHOT_GET_SCREEN_INFO = 'screenshot:getScreenInfo',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',
  SETTINGS_RESET = 'settings:reset',

  // Sessions
  SESSION_CREATE = 'session:create',
  SESSION_GET = 'session:get',
  SESSION_LIST = 'session:list',
  SESSION_DELETE = 'session:delete',

  // System
  SYSTEM_INFO = 'system:info',
  SYSTEM_PERMISSIONS = 'system:permissions',

  // Updates
  UPDATE_CHECK = 'update:check',
  UPDATE_DOWNLOAD = 'update:download',
  UPDATE_INSTALL = 'update:install',

  // Notifications
  NOTIFICATION_SHOW = 'notification:show',
  NOTIFICATION_CLEAR = 'notification:clear',

  // App
  APP_VERSION = 'app:version',

  // Window
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_CLOSE = 'window:close'
}

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // Agent control
  agent: {
    start: (agentType: string, instruction: string, config?: any) => Promise<IPCResponse>;
    pause: (agentId: string) => Promise<IPCResponse>;
    resume: (agentId: string) => Promise<IPCResponse>;
    stop: (agentId: string) => Promise<IPCResponse>;
    getStatus: (agentId: string) => Promise<IPCResponse>;
  };

  // Screenshot
  screenshot: {
    take: (options?: any) => Promise<IPCResponse>;
    takeRegion: (options: any) => Promise<IPCResponse>;
    getScreenInfo: () => Promise<IPCResponse>;
  };

  // Settings
  settings: {
    get: (category?: string) => Promise<IPCResponse>;
    set: (category: string, settings: any) => Promise<IPCResponse>;
    reset: (category?: string) => Promise<IPCResponse>;
  };

  // Sessions
  session: {
    create: (data: any) => Promise<IPCResponse>;
    get: (sessionId: string) => Promise<IPCResponse>;
    list: () => Promise<IPCResponse>;
    delete: (sessionId: string) => Promise<IPCResponse>;
  };

  // System
  system: {
    getInfo: () => Promise<IPCResponse>;
    getAppVersion: () => Promise<IPCResponse>;
  };

  // Window controls
  window: {
    minimize: () => Promise<IPCResponse>;
    maximize: () => Promise<IPCResponse>;
    close: () => Promise<IPCResponse>;
  };

  // Event listeners
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  off: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  once: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;

  // Utility
  removeAllListeners: (channel: string) => void;
}

// Helper function to create IPC requests
function createRequest<T = any>(data?: T): IPCRequest<T> {
  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    data: data as T
  };
}

// Helper function to invoke IPC with error handling
async function invokeIPC<T = any>(channel: IPCChannel, data?: T): Promise<IPCResponse> {
  try {
    const request = createRequest(data);
    const response = await ipcRenderer.invoke(channel, request);
    return response;
  } catch (error) {
    console.error(`IPC call failed for channel ${channel}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    };
  }
}

// Define the API implementation
const electronAPI: ElectronAPI = {
  // Agent control methods
  agent: {
    start: (agentType: string, instruction: string, config?: any) =>
      invokeIPC(IPCChannel.AGENT_START, { agentType, instruction, config }),

    pause: (agentId: string) =>
      invokeIPC(IPCChannel.AGENT_PAUSE, { agentId }),

    resume: (agentId: string) =>
      invokeIPC(IPCChannel.AGENT_RESUME, { agentId }),

    stop: (agentId: string) =>
      invokeIPC(IPCChannel.AGENT_STOP, { agentId }),

    getStatus: (agentId: string) =>
      invokeIPC(IPCChannel.AGENT_STATUS, { agentId })
  },

  // Screenshot methods
  screenshot: {
    take: (options?: any) =>
      invokeIPC(IPCChannel.SCREENSHOT_TAKE, options),

    takeRegion: (options: any) =>
      invokeIPC(IPCChannel.SCREENSHOT_REGION, options),

    getScreenInfo: () =>
      invokeIPC(IPCChannel.SCREENSHOT_GET_SCREEN_INFO, {})
  },

  // Settings methods
  settings: {
    get: (category?: string) =>
      invokeIPC(IPCChannel.SETTINGS_GET, { category }),

    set: (category: string, settings: any) =>
      invokeIPC(IPCChannel.SETTINGS_SET, { category, settings }),

    reset: (category?: string) =>
      invokeIPC(IPCChannel.SETTINGS_RESET, { category })
  },

  // Session methods
  session: {
    create: (data: any) =>
      invokeIPC(IPCChannel.SESSION_CREATE, data),

    get: (sessionId: string) =>
      invokeIPC(IPCChannel.SESSION_GET, { sessionId }),

    list: () =>
      invokeIPC(IPCChannel.SESSION_LIST),

    delete: (sessionId: string) =>
      invokeIPC(IPCChannel.SESSION_DELETE, { sessionId })
  },

  // System methods
  system: {
    getInfo: () =>
      invokeIPC(IPCChannel.SYSTEM_INFO),

    getAppVersion: () =>
      invokeIPC(IPCChannel.APP_VERSION)
  },

  // Window control methods
  window: {
    minimize: () =>
      invokeIPC(IPCChannel.WINDOW_MINIMIZE),

    maximize: () =>
      invokeIPC(IPCChannel.WINDOW_MAXIMIZE),

    close: () =>
      invokeIPC(IPCChannel.WINDOW_CLOSE)
  },

  // Event listener methods
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    // Validate channel to prevent security issues
    const allowedChannels = [
      'agent-status-changed',
      'agent-action-completed',
      'agent-error',
      'screenshot-taken',
      'settings-changed',
      'session-updated',
      'update-download-progress',
      'notification'
    ];

    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    } else {
      console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
    }
  },

  off: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.off(channel, callback);
  },

  once: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    const allowedChannels = [
      'agent-status-changed',
      'agent-action-completed',
      'agent-error',
      'screenshot-taken',
      'settings-changed',
      'session-updated',
      'update-download-progress',
      'notification'
    ];

    if (allowedChannels.includes(channel)) {
      ipcRenderer.once(channel, callback);
    } else {
      console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
    }
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Also expose some Node.js globals that might be needed
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  arch: process.arch,
  versions: process.versions
});

// Security: Remove Node.js globals from window object
// Note: These are already removed by contextIsolation

// Log that preload script has loaded
console.log('Robin Assistant preload script loaded');
