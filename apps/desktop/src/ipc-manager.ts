import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import log from 'electron-log';
import { AgentManager } from './agent-manager';
import { SettingsManager } from './settings-manager';
import { WindowManager } from './window-manager';
import { screenshotService } from './screenshot-service';
import { 
  IPCRequest, 
  IPCResponse, 
  IPCChannel,
  AgentStartRequest,
  AgentControlRequest,
  SettingsRequest,
  ScreenshotRequest
} from '@robin/ipc';

export class IPCManager {
  private agentManager: AgentManager;
  private settingsManager: SettingsManager;
  private windowManager: WindowManager;

  constructor(
    agentManager: AgentManager,
    settingsManager: SettingsManager,
    windowManager: WindowManager
  ) {
    this.agentManager = agentManager;
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    
    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    // Agent control handlers
    ipcMain.handle(IPCChannel.AGENT_START, this.handleAgentStart.bind(this));
    ipcMain.handle(IPCChannel.AGENT_PAUSE, this.handleAgentPause.bind(this));
    ipcMain.handle(IPCChannel.AGENT_RESUME, this.handleAgentResume.bind(this));
    ipcMain.handle(IPCChannel.AGENT_STOP, this.handleAgentStop.bind(this));
    ipcMain.handle(IPCChannel.AGENT_STATUS, this.handleAgentStatus.bind(this));

    // Screenshot handlers
    ipcMain.handle(IPCChannel.SCREENSHOT_TAKE, this.handleTakeScreenshot.bind(this));
    ipcMain.handle(IPCChannel.SCREENSHOT_REGION, this.handleTakeRegionScreenshot.bind(this));
    ipcMain.handle(IPCChannel.SCREENSHOT_GET_SCREEN_INFO, this.handleGetScreenInfo.bind(this));

    // Settings handlers
    ipcMain.handle(IPCChannel.SETTINGS_GET, this.handleGetSettings.bind(this));
    ipcMain.handle(IPCChannel.SETTINGS_SET, this.handleSetSettings.bind(this));
    ipcMain.handle(IPCChannel.SETTINGS_RESET, this.handleResetSettings.bind(this));

    // Session handlers
    ipcMain.handle(IPCChannel.SESSION_CREATE, this.handleCreateSession.bind(this));
    ipcMain.handle(IPCChannel.SESSION_GET, this.handleGetSession.bind(this));
    ipcMain.handle(IPCChannel.SESSION_LIST, this.handleListSessions.bind(this));
    ipcMain.handle(IPCChannel.SESSION_DELETE, this.handleDeleteSession.bind(this));

    // System handlers
    ipcMain.handle(IPCChannel.SYSTEM_INFO, this.handleGetSystemInfo.bind(this));
    ipcMain.handle(IPCChannel.APP_VERSION, this.handleGetAppVersion.bind(this));

    // Window handlers
    ipcMain.handle(IPCChannel.WINDOW_MINIMIZE, this.handleWindowMinimize.bind(this));
    ipcMain.handle(IPCChannel.WINDOW_MAXIMIZE, this.handleWindowMaximize.bind(this));
    ipcMain.handle(IPCChannel.WINDOW_CLOSE, this.handleWindowClose.bind(this));

    log.info('IPC handlers registered successfully');
  }

  // Agent control handlers
  private async handleAgentStart(
    event: IpcMainInvokeEvent,
    request: IPCRequest<AgentStartRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data) {
        throw new Error('Request data is required');
      }

      log.info('Starting agent with request:', request.data);

      const result = await this.agentManager.startAgent(
        request.data.agentType as 'local' | 'browser' | 'hybrid',
        request.data.instruction,
        request.data.config
      );

      return {
        success: true,
        data: result,
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to start agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleAgentPause(
    event: IpcMainInvokeEvent,
    request: IPCRequest<AgentControlRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data) {
        throw new Error('Request data is required');
      }

      await this.agentManager.pauseAgent(request.data.agentId);
      return {
        success: true,
        data: { agentId: request.data.agentId, status: 'paused' },
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to pause agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleAgentResume(
    event: IpcMainInvokeEvent,
    request: IPCRequest<AgentControlRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data) {
        throw new Error('Request data is required');
      }

      await this.agentManager.resumeAgent(request.data.agentId);
      return {
        success: true,
        data: { agentId: request.data.agentId, status: 'running' },
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to resume agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleAgentStop(
    event: IpcMainInvokeEvent,
    request: IPCRequest<AgentControlRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data) {
        throw new Error('Request data is required');
      }

      await this.agentManager.stopAgent(request.data.agentId);
      return {
        success: true,
        data: { agentId: request.data.agentId, status: 'stopped' },
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to stop agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleAgentStatus(
    event: IpcMainInvokeEvent,
    request: IPCRequest<AgentControlRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data) {
        throw new Error('Request data is required');
      }

      const status = await this.agentManager.getAgentStatus(request.data.agentId);
      return {
        success: true,
        data: status,
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to get agent status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // Screenshot handlers
  private async handleTakeScreenshot(
    event: IpcMainInvokeEvent,
    request: IPCRequest<ScreenshotRequest>
  ): Promise<IPCResponse> {
    try {
      log.info('Taking screenshot via screenshot service...');
      const result = await screenshotService.takeScreenshot(request.data || {});

      if (result.success) {
        return {
          success: true,
          data: result.data,
          timestamp: Date.now()
        };
      } else {
        throw new Error(result.error || 'Screenshot failed');
      }
    } catch (error) {
      log.error('Failed to take screenshot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleTakeRegionScreenshot(
    event: IpcMainInvokeEvent,
    request: IPCRequest<ScreenshotRequest>
  ): Promise<IPCResponse> {
    try {
      log.info('Taking region screenshot via screenshot service...');

      const region = request.data?.region;
      if (!region) {
        throw new Error('Region coordinates are required for region screenshot');
      }

      const result = await screenshotService.takeRegionScreenshot(region);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          timestamp: Date.now()
        };
      } else {
        throw new Error(result.error || 'Region screenshot failed');
      }
    } catch (error) {
      log.error('Failed to take region screenshot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleGetScreenInfo(
    event: IpcMainInvokeEvent,
    request?: IPCRequest<any>
  ): Promise<IPCResponse> {
    try {
      log.info('Getting screen info via screenshot service...');
      const result = await screenshotService.getScreenInfo();

      if (result.success) {
        return {
          success: true,
          data: result,
          timestamp: Date.now()
        };
      } else {
        throw new Error(result.error || 'Failed to get screen info');
      }
    } catch (error) {
      log.error('Failed to get screen info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // Settings handlers
  private async handleGetSettings(
    event: IpcMainInvokeEvent,
    request: IPCRequest<SettingsRequest>
  ): Promise<IPCResponse> {
    try {
      const settings = await this.settingsManager.getSettings(request.data?.category);
      return {
        success: true,
        data: settings,
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to get settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleSetSettings(
    event: IpcMainInvokeEvent,
    request: IPCRequest<SettingsRequest>
  ): Promise<IPCResponse> {
    try {
      if (!request.data?.category || !request.data?.settings) {
        throw new Error('Category and settings are required');
      }

      await this.settingsManager.setSettings(request.data.category, request.data.settings);
      return {
        success: true,
        data: { updated: true },
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to set settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleResetSettings(
    event: IpcMainInvokeEvent,
    request: IPCRequest<SettingsRequest>
  ): Promise<IPCResponse> {
    try {
      await this.settingsManager.resetSettings(request.data?.category);
      return {
        success: true,
        data: { reset: true },
        timestamp: Date.now()
      };
    } catch (error) {
      log.error('Failed to reset settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // Session handlers
  private async handleCreateSession(event: IpcMainInvokeEvent, request: IPCRequest): Promise<IPCResponse> {
    try {
      const session = await this.settingsManager.createSession(request.data || {});
      return {
        success: true,
        data: session,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleGetSession(event: IpcMainInvokeEvent, request: IPCRequest): Promise<IPCResponse> {
    try {
      if (!request.data?.sessionId) {
        throw new Error('Session ID is required');
      }

      const session = await this.settingsManager.getSession(request.data.sessionId);
      return {
        success: true,
        data: session,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleListSessions(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const sessions = await this.settingsManager.listSessions();
      return {
        success: true,
        data: sessions,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleDeleteSession(event: IpcMainInvokeEvent, request: IPCRequest): Promise<IPCResponse> {
    try {
      if (!request.data?.sessionId) {
        throw new Error('Session ID is required');
      }

      await this.settingsManager.deleteSession(request.data.sessionId);
      return {
        success: true,
        data: { deleted: true },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // System handlers
  private async handleGetSystemInfo(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome
      };
      
      return {
        success: true,
        data: systemInfo,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleGetAppVersion(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const { app } = require('electron');
      return {
        success: true,
        data: { version: app.getVersion() },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // Window handlers
  private async handleWindowMinimize(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.minimize();
      }
      return {
        success: true,
        data: { minimized: true },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleWindowMaximize(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      }
      return {
        success: true,
        data: { maximized: window?.isMaximized() },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async handleWindowClose(event: IpcMainInvokeEvent): Promise<IPCResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.close();
      }
      return {
        success: true,
        data: { closed: true },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  // Send events to renderer
  sendToRenderer(channel: string, data: any): void {
    const mainWindow = this.windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }

  // Broadcast to all windows
  broadcast(channel: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }
}
