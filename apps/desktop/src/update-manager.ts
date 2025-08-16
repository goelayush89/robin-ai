import { autoUpdater, UpdateInfo } from 'electron-updater';
import { dialog, BrowserWindow, Notification } from 'electron';
import log from 'electron-log';
import * as semver from 'semver';

export interface UpdateStatus {
  available: boolean;
  version?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
}

export class UpdateManager {
  private updateStatus: UpdateStatus = { available: false };
  private isChecking = false;
  private isDownloading = false;
  private autoDownload = true;
  private autoInstall = false;

  constructor() {
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto updater
    autoUpdater.autoDownload = this.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.autoInstall;

    // Set up logging
    autoUpdater.logger = log;

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.isChecking = true;
      this.updateStatus = { available: false };
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('Update available:', info);
      this.isChecking = false;
      this.updateStatus = {
        available: true,
        version: info.version,
        releaseNotes: info.releaseNotes as string
      };
      
      this.handleUpdateAvailable(info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('Update not available:', info);
      this.isChecking = false;
      this.updateStatus = { available: false };
    });

    autoUpdater.on('error', (error) => {
      log.error('Auto updater error:', error);
      this.isChecking = false;
      this.isDownloading = false;
      this.updateStatus = {
        available: false,
        error: error.message
      };
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      
      this.updateStatus = {
        ...this.updateStatus,
        downloadProgress: percent
      };
      
      // Update notification or window
      this.updateDownloadProgress(percent);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('Update downloaded:', info);
      this.isDownloading = false;
      this.updateStatus = {
        ...this.updateStatus,
        downloadProgress: 100
      };
      
      this.handleUpdateDownloaded(info);
    });
  }

  async checkForUpdates(showNoUpdateDialog = false): Promise<UpdateStatus> {
    if (this.isChecking) {
      return this.updateStatus;
    }

    try {
      log.info('Manually checking for updates...');
      const result = await autoUpdater.checkForUpdates();
      
      if (showNoUpdateDialog && !this.updateStatus.available) {
        dialog.showMessageBox({
          type: 'info',
          title: 'No Updates Available',
          message: 'You are running the latest version of Robin Assistant.',
          buttons: ['OK']
        });
      }
      
      return this.updateStatus;
    } catch (error) {
      log.error('Failed to check for updates:', error);
      
      if (showNoUpdateDialog) {
        dialog.showErrorBox('Update Check Failed', 'Failed to check for updates. Please try again later.');
      }
      
      this.updateStatus = {
        available: false,
        error: error instanceof Error ? error.message : String(error)
      };
      
      return this.updateStatus;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!this.updateStatus.available || this.isDownloading) {
      return;
    }

    try {
      log.info('Starting update download...');
      this.isDownloading = true;
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      this.isDownloading = false;
      throw error;
    }
  }

  async installUpdate(): Promise<void> {
    try {
      log.info('Installing update...');
      autoUpdater.quitAndInstall();
    } catch (error) {
      log.error('Failed to install update:', error);
      throw error;
    }
  }

  private async handleUpdateAvailable(info: UpdateInfo): Promise<void> {
    const currentVersion = require('../../package.json').version;
    const newVersion = info.version;
    
    // Check if this is a major update
    const isMajorUpdate = semver.major(newVersion) > semver.major(currentVersion);
    
    // Show notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Update Available',
        body: `Robin Assistant ${newVersion} is available. Click to learn more.`,
        icon: this.getNotificationIcon()
      });
      
      notification.on('click', () => {
        this.showUpdateDialog(info, isMajorUpdate);
      });
      
      notification.show();
    } else {
      // Fallback to dialog if notifications not supported
      this.showUpdateDialog(info, isMajorUpdate);
    }
  }

  private async showUpdateDialog(info: UpdateInfo, isMajorUpdate: boolean): Promise<void> {
    const releaseNotes = this.formatReleaseNotes(info.releaseNotes as string);
    
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Robin Assistant ${info.version} is available`,
      detail: `Current version: ${require('../../package.json').version}\n\n${releaseNotes}`,
      buttons: isMajorUpdate 
        ? ['Download Later', 'Download Now', 'Learn More']
        : ['Download Later', 'Download and Install', 'Learn More'],
      defaultId: 1,
      cancelId: 0
    });

    switch (result.response) {
      case 1: // Download/Install
        if (isMajorUpdate) {
          await this.downloadUpdate();
        } else {
          await this.downloadUpdate();
          // Auto-install for minor updates
          setTimeout(() => {
            this.installUpdate();
          }, 1000);
        }
        break;
      case 2: // Learn More
        require('electron').shell.openExternal(`https://github.com/robin-assistant/releases/tag/v${info.version}`);
        break;
    }
  }

  private async handleUpdateDownloaded(info: UpdateInfo): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Robin Assistant ${info.version} has been downloaded and is ready to install.`,
      detail: 'The application will restart to apply the update.',
      buttons: ['Install Later', 'Install Now'],
      defaultId: 1
    });

    if (result.response === 1) {
      this.installUpdate();
    }
  }

  private updateDownloadProgress(percent: number): void {
    // Update any open windows about download progress
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('update-download-progress', percent);
      }
    });
  }

  private formatReleaseNotes(releaseNotes: string): string {
    if (!releaseNotes) {
      return 'No release notes available.';
    }

    // Basic formatting for release notes
    return releaseNotes
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\*\s/g, '• ') // Convert bullet points
      .substring(0, 300) + (releaseNotes.length > 300 ? '...' : '');
  }

  private getNotificationIcon(): string {
    // Return path to notification icon
    const path = require('path');
    return path.join(__dirname, '../assets/icon.png');
  }

  // Public getters
  getUpdateStatus(): UpdateStatus {
    return { ...this.updateStatus };
  }

  isUpdateAvailable(): boolean {
    return this.updateStatus.available;
  }

  isCheckingForUpdates(): boolean {
    return this.isChecking;
  }

  isDownloadingUpdate(): boolean {
    return this.isDownloading;
  }

  // Configuration methods
  setAutoDownload(enabled: boolean): void {
    this.autoDownload = enabled;
    autoUpdater.autoDownload = enabled;
    log.info(`Auto download ${enabled ? 'enabled' : 'disabled'}`);
  }

  setAutoInstall(enabled: boolean): void {
    this.autoInstall = enabled;
    autoUpdater.autoInstallOnAppQuit = enabled;
    log.info(`Auto install on quit ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Development/testing methods
  setFeedURL(url: string): void {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: url
    });
    log.info(`Update feed URL set to: ${url}`);
  }

  async checkForUpdatesAndNotify(): Promise<void> {
    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Failed to check for updates and notify:', error);
    }
  }

  // Cleanup
  cleanup(): void {
    autoUpdater.removeAllListeners();
    log.info('Update manager cleaned up');
  }
}
