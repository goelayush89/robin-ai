/**
 * Electron-specific screen capture implementation using Electron APIs
 */

export interface ElectronScreenshot {
  data: string; // Base64 encoded image
  width: number;
  height: number;
  timestamp: number;
}

export class ElectronScreenCapture {
  private isElectron: boolean = false;
  private electronAPI: any = null;

  constructor() {
    // Detect if we're running in Electron
    this.isElectron = this.detectElectron();
    if (this.isElectron) {
      this.electronAPI = (window as any).electronAPI;
      console.log('Electron environment detected:', {
        isElectron: this.isElectron,
        hasElectronAPI: !!this.electronAPI,
        hasScreenshotAPI: !!(this.electronAPI?.screenshot),
        electronAPIKeys: this.electronAPI ? Object.keys(this.electronAPI) : []
      });
    } else {
      console.log('Not in Electron environment');
    }
  }

  private detectElectron(): boolean {
    // Check for Electron-specific properties
    return !!(
      (window as any).electronAPI ||
      (window as any).nodeAPI ||
      navigator.userAgent.toLowerCase().includes('electron')
    );
  }

  async isSupported(): Promise<boolean> {
    return this.isElectron && !!this.electronAPI?.screenshot;
  }

  async initialize(): Promise<void> {
    if (!this.isElectron) {
      throw new Error('Not running in Electron environment');
    }

    if (!this.electronAPI?.screenshot) {
      throw new Error('Electron screenshot API not available');
    }

    // No initialization needed for Electron - it has native access
    console.log('Electron screen capture initialized');
  }

  async captureScreen(options?: any): Promise<ElectronScreenshot> {
    if (!this.isElectron || !this.electronAPI?.screenshot) {
      throw new Error('Electron screenshot API not available');
    }

    try {
      // Use Electron's screenshot API through IPC
      const response = await this.electronAPI.screenshot.take(options);
      
      if (!response.success) {
        throw new Error(response.error || 'Screenshot failed');
      }

      const screenshot = response.data;
      
      return {
        data: screenshot.data,
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp || Date.now()
      };
    } catch (error) {
      console.error('Electron screenshot failed:', error);
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async captureRegion(options: { x: number; y: number; width: number; height: number }): Promise<ElectronScreenshot> {
    if (!this.isElectron || !this.electronAPI?.screenshot) {
      throw new Error('Electron screenshot API not available');
    }

    try {
      const response = await this.electronAPI.screenshot.takeRegion(options);
      
      if (!response.success) {
        throw new Error(response.error || 'Region screenshot failed');
      }

      const screenshot = response.data;
      
      return {
        data: screenshot.data,
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp || Date.now()
      };
    } catch (error) {
      console.error('Electron region screenshot failed:', error);
      throw new Error(`Region screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for Electron
    console.log('Electron screen capture cleaned up');
  }

  getCapabilities() {
    return {
      supported: this.isElectron,
      canCaptureScreen: this.isElectron,
      canCaptureRegion: this.isElectron,
      canCaptureWindow: this.isElectron,
      requiresPermission: false, // Electron has native access
      environment: 'electron'
    };
  }
}

// Utility functions for screen capture detection and setup
export function isElectronEnvironment(): boolean {
  return !!(
    (window as any).electronAPI ||
    (window as any).nodeAPI ||
    navigator.userAgent.toLowerCase().includes('electron')
  );
}

export function getElectronScreenCaptureInfo() {
  const isElectron = isElectronEnvironment();
  const electronAPI = (window as any).electronAPI;
  const hasAPI = !!(electronAPI?.screenshot);

  console.log('Electron screen capture info check:', {
    isElectron,
    hasElectronAPI: !!electronAPI,
    hasScreenshotAPI: hasAPI,
    electronAPIKeys: electronAPI ? Object.keys(electronAPI) : [],
    userAgent: navigator.userAgent
  });

  if (!isElectron) {
    return {
      supported: false,
      reason: 'Not running in Electron environment',
      suggestions: [
        'Use the desktop app for full screen capture capabilities',
        'Or use the browser version with limited web-based screen capture'
      ]
    };
  }

  if (!hasAPI) {
    return {
      supported: false,
      reason: 'Electron screenshot API not available',
      suggestions: [
        'Update to the latest version of the desktop app',
        'Restart the application',
        'Check if the app has proper permissions'
      ]
    };
  }

  return {
    supported: true,
    reason: 'Electron native screen capture available',
    capabilities: {
      fullScreen: true,
      regionCapture: true,
      windowCapture: true,
      noPermissionRequired: true
    }
  };
}

export async function requestElectronScreenCapturePermission(): Promise<boolean> {
  const isElectron = isElectronEnvironment();
  
  if (!isElectron) {
    throw new Error('Not running in Electron environment');
  }

  // Electron doesn't need permission requests - it has native access
  // Just verify the API is available
  const hasAPI = !!(window as any).electronAPI?.screenshot;
  
  if (!hasAPI) {
    throw new Error('Electron screenshot API not available');
  }

  // Test the API by attempting a screenshot
  try {
    const electronAPI = (window as any).electronAPI;
    const response = await electronAPI.screenshot.take({ test: true });
    return response.success;
  } catch (error) {
    console.error('Electron screenshot test failed:', error);
    return false;
  }
}

// Create a unified screen capture service that works in both environments
export class UnifiedScreenCapture {
  private electronCapture: ElectronScreenCapture | null = null;
  private browserCapture: any = null; // Will be imported dynamically
  private isElectron: boolean;

  constructor() {
    this.isElectron = isElectronEnvironment();
    
    if (this.isElectron) {
      this.electronCapture = new ElectronScreenCapture();
    }
  }

  async initialize(): Promise<void> {
    if (this.isElectron && this.electronCapture) {
      await this.electronCapture.initialize();
    } else {
      // Dynamically import browser screen capture for web environment
      const { BrowserScreenCapture } = await import('./browser-screen-capture');
      this.browserCapture = new BrowserScreenCapture();
      await this.browserCapture.initialize();
    }
  }

  async isSupported(): Promise<boolean> {
    if (this.isElectron && this.electronCapture) {
      return await this.electronCapture.isSupported();
    } else if (this.browserCapture) {
      return this.browserCapture.isSupported();
    }
    return false;
  }

  async captureScreen(options?: any): Promise<ElectronScreenshot> {
    if (this.isElectron && this.electronCapture) {
      return await this.electronCapture.captureScreen(options);
    } else if (this.browserCapture) {
      return await this.browserCapture.captureScreen(options);
    }
    throw new Error('No screen capture method available');
  }

  async captureRegion(options: { x: number; y: number; width: number; height: number }): Promise<ElectronScreenshot> {
    if (this.isElectron && this.electronCapture) {
      return await this.electronCapture.captureRegion(options);
    } else if (this.browserCapture) {
      // Browser capture might not support regions
      return await this.browserCapture.captureScreen(options);
    }
    throw new Error('No region capture method available');
  }

  async cleanup(): Promise<void> {
    if (this.electronCapture) {
      await this.electronCapture.cleanup();
    }
    if (this.browserCapture) {
      await this.browserCapture.cleanup();
    }
  }

  getEnvironment(): 'electron' | 'browser' {
    return this.isElectron ? 'electron' : 'browser';
  }

  getCapabilities() {
    if (this.isElectron && this.electronCapture) {
      return this.electronCapture.getCapabilities();
    }
    return {
      supported: false,
      environment: 'browser',
      requiresPermission: true
    };
  }
}
