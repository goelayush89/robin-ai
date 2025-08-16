import {
  app,
  BrowserWindow,
  Menu,
  shell,
  dialog,
  globalShortcut,
  powerMonitor,
  systemPreferences
} from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import log from 'electron-log';
import Store from 'electron-store';
import { machineId } from 'node-machine-id';

// Import our modules
import { WindowManager } from './window-manager';
import { IPCManager } from './ipc-manager';
import { AgentManager } from './agent-manager';
import { SecurityManager } from './security-manager';
import { SettingsManager } from './settings-manager';
import { UpdateManager } from './update-manager';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';

// Global managers
let windowManager: WindowManager;
let ipcManager: IPCManager;
let agentManager: AgentManager;
let securityManager: SecurityManager;
let settingsManager: SettingsManager;
let updateManager: UpdateManager;

// Application state
interface AppState {
  isReady: boolean;
  machineId: string;
  startupTime: number;
}

const appState: AppState = {
  isReady: false,
  machineId: '',
  startupTime: Date.now()
};

// Initialize store with schema
const store = new Store<Record<string, any>>({
  schema: {
    windowBounds: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' }
      },
      default: { width: 1200, height: 800 }
    },
    settings: {
      type: 'object',
      default: {}
    },
    sessions: {
      type: 'array',
      default: []
    }
  }
});

async function initializeApp(): Promise<void> {
  try {
    log.info('Initializing Robin Assistant...');

    // Get machine ID for security
    appState.machineId = await machineId();

    // Initialize managers
    securityManager = new SecurityManager(appState.machineId);
    settingsManager = new SettingsManager(store, securityManager);
    windowManager = new WindowManager(store, settingsManager);
    agentManager = new AgentManager(settingsManager);
    ipcManager = new IPCManager(agentManager, settingsManager, windowManager);
    updateManager = new UpdateManager();

    // Setup global shortcuts
    setupGlobalShortcuts();

    // Setup power monitoring
    setupPowerMonitoring();

    // Request permissions on macOS
    if (process.platform === 'darwin') {
      await requestMacOSPermissions();
    }

    appState.isReady = true;
    log.info('Robin Assistant initialized successfully');

  } catch (error) {
    log.error('Failed to initialize app:', error);
    dialog.showErrorBox('Initialization Error', 'Failed to initialize Robin Assistant. Please restart the application.');
    app.quit();
  }
}

function setupGlobalShortcuts(): void {
  // Global shortcut to show/hide main window
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (windowManager) {
      windowManager.toggleMainWindow();
    }
  });

  // Global shortcut for quick screenshot
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (agentManager) {
      agentManager.takeQuickScreenshot();
    }
  });
}

function setupPowerMonitoring(): void {
  powerMonitor.on('suspend', () => {
    log.info('System is going to sleep');
    if (agentManager) {
      agentManager.pauseAllAgents();
    }
  });

  powerMonitor.on('resume', () => {
    log.info('System has resumed');
    if (agentManager) {
      agentManager.resumeAllAgents();
    }
  });
}

async function requestMacOSPermissions(): Promise<void> {
  // Request screen recording permissions
  const screenStatus = systemPreferences.getMediaAccessStatus('screen');
  if (screenStatus !== 'granted') {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Screen Recording Permission Required',
      message: 'Robin Assistant needs screen recording permission to take screenshots.',
      detail: 'Please grant screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording',
      buttons: ['Open System Preferences', 'Cancel'],
      defaultId: 0
    });

    if (result.response === 0) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
  }
}

// App event handlers
app.whenReady().then(async () => {
  await initializeApp();

  // Create main window
  if (windowManager) {
    await windowManager.createMainWindow();
  }

  // Setup menu
  setupApplicationMenu();

  // Check for updates in production
  if (!isDev && updateManager) {
    updateManager.checkForUpdates();
  }
});

app.on('window-all-closed', () => {
  // Cleanup global shortcuts
  globalShortcut.unregisterAll();

  // Cleanup agents
  if (agentManager) {
    agentManager.cleanup();
  }

  // Quit on all platforms except macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0 && windowManager) {
    await windowManager.createMainWindow();
  }
});

app.on('before-quit', (event) => {
  log.info('Application is quitting...');

  // Save application state
  if (settingsManager) {
    settingsManager.saveSettings();
  }

  // Cleanup agents
  if (agentManager) {
    agentManager.cleanup();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow navigation to localhost in development
    if (isDev && parsedUrl.hostname === 'localhost') {
      return;
    }

    // Allow navigation to file:// protocol for local files
    if (parsedUrl.protocol === 'file:') {
      return;
    }

    // Prevent navigation to external URLs
    event.preventDefault();
  });
});

function setupApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Robin Assistant',
      submenu: [
        {
          label: 'About Robin Assistant',
          click: () => {
            if (windowManager) {
              windowManager.showAboutDialog();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (windowManager) {
              windowManager.showSettingsWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Robin Assistant',
          accelerator: 'CmdOrCtrl+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'CmdOrCtrl+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Agent',
      submenu: [
        {
          label: 'Start Agent',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => {
            if (agentManager) {
              agentManager.startDefaultAgent();
            }
          }
        },
        {
          label: 'Pause Agent',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (agentManager) {
              agentManager.pauseAllAgents();
            }
          }
        },
        {
          label: 'Stop Agent',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (agentManager) {
              agentManager.stopAllAgents();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Take Screenshot',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            if (agentManager) {
              agentManager.takeQuickScreenshot();
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        {
          label: 'Main Window',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (windowManager) {
              windowManager.focusMainWindow();
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/robin-assistant/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/robin-assistant/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            if (updateManager) {
              updateManager.checkForUpdates();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
export { appState, store };
