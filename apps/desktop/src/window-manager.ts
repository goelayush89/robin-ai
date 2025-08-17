import { BrowserWindow, screen, dialog, app } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import log from 'electron-log';
import Store from 'electron-store';
import { SettingsManager } from './settings-manager';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private aboutWindow: BrowserWindow | null = null;
  private store: Store;
  private settingsManager: SettingsManager;

  constructor(store: Store, settingsManager: SettingsManager) {
    this.store = store;
    this.settingsManager = settingsManager;
  }

  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    // Get saved window bounds or use defaults
    const savedBounds = this.store.get('windowBounds') as WindowBounds;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Ensure window fits on screen
    const bounds: WindowBounds = {
      width: Math.min(savedBounds.width || 1200, screenWidth),
      height: Math.min(savedBounds.height || 800, screenHeight),
      x: savedBounds.x,
      y: savedBounds.y
    };

    // Center window if no saved position
    if (bounds.x === undefined || bounds.y === undefined) {
      bounds.x = Math.round((screenWidth - bounds.width) / 2);
      bounds.y = Math.round((screenHeight - bounds.height) / 2);
    }

    this.mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: 800,
      minHeight: 600,
      show: false, // Don't show until ready
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !isDev,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      icon: this.getAppIcon()
    });

    // Save window bounds when moved or resized
    this.mainWindow.on('moved', () => this.saveWindowBounds());
    this.mainWindow.on('resized', () => this.saveWindowBounds());

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window ready to show
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        
        // Focus window on creation
        if (isDev) {
          this.mainWindow.webContents.openDevTools();
        }
      }
    });

    // Load the application
    await this.loadApplication(this.mainWindow);

    log.info('Main window created successfully');
    return this.mainWindow;
  }

  async createSettingsWindow(): Promise<BrowserWindow> {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 400,
      parent: this.mainWindow || undefined,
      modal: true,
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !isDev
      }
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    this.settingsWindow.once('ready-to-show', () => {
      if (this.settingsWindow) {
        this.settingsWindow.show();
      }
    });

    // Load embedded settings page
    await this.settingsWindow.loadFile(
      path.join(__dirname, 'renderer/index.html')
    );

    return this.settingsWindow;
  }

  showAboutDialog(): void {
    const window = this.mainWindow || undefined;
    dialog.showMessageBox(window as any, {
      type: 'info',
      title: 'About Robin Assistant',
      message: 'Robin Assistant',
      detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`,
      buttons: ['OK']
    });
  }

  async showSettingsWindow(): Promise<void> {
    await this.createSettingsWindow();
  }

  toggleMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }
  }

  focusMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow;
  }

  private async loadApplication(window: BrowserWindow): Promise<void> {
    try {
      // Load embedded HTML file from dist/renderer directory
      const indexPath = path.join(__dirname, 'renderer/index.html');
      log.info('Loading embedded application from:', indexPath);
      await window.loadFile(indexPath);
    } catch (error) {
      log.error('Failed to load application:', error);
      throw error;
    }
  }

  private saveWindowBounds(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const bounds = this.mainWindow.getBounds();
      this.store.set('windowBounds', bounds);
    }
  }

  private getAppIcon(): string | undefined {
    if (process.platform === 'win32') {
      return path.join(__dirname, '../assets/icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(__dirname, '../assets/icon.icns');
    } else {
      return path.join(__dirname, '../assets/icon.png');
    }
  }

  cleanup(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.saveWindowBounds();
      this.mainWindow.close();
    }

    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }

    if (this.aboutWindow && !this.aboutWindow.isDestroyed()) {
      this.aboutWindow.close();
    }
  }
}
