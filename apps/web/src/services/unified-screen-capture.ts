/**
 * Unified screen capture service that works in both Electron and browser environments
 */

import { isElectronEnvironment, UnifiedScreenCapture } from './electron-screen-capture';

export interface Screenshot {
  data: string; // Base64 encoded image
  width: number;
  height: number;
  timestamp: number;
}

export interface ScreenCaptureCapabilities {
  supported: boolean;
  environment: 'electron' | 'browser';
  canCaptureScreen: boolean;
  canCaptureRegion: boolean;
  canCaptureWindow: boolean;
  requiresPermission: boolean;
}

class ScreenCaptureManager {
  private static instance: ScreenCaptureManager;
  private unifiedCapture: UnifiedScreenCapture | null = null;
  private isInitialized = false;
  private isElectron: boolean;

  private constructor() {
    this.isElectron = isElectronEnvironment();
  }

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.unifiedCapture = new UnifiedScreenCapture();
      await this.unifiedCapture.initialize();
      this.isInitialized = true;
      console.log(`Screen capture initialized for ${this.isElectron ? 'Electron' : 'browser'} environment`);
    } catch (error) {
      console.error('Failed to initialize screen capture:', error);
      throw error;
    }
  }

  async isSupported(): Promise<boolean> {
    if (!this.unifiedCapture) {
      return false;
    }
    return await this.unifiedCapture.isSupported();
  }

  async captureScreen(options?: any): Promise<Screenshot> {
    if (!this.isInitialized || !this.unifiedCapture) {
      throw new Error('Screen capture not initialized');
    }

    try {
      const screenshot = await this.unifiedCapture.captureScreen(options);
      
      // Ensure data is in the correct format
      let imageData = screenshot.data;
      if (!imageData.startsWith('data:image/')) {
        imageData = `data:image/png;base64,${imageData}`;
      }

      return {
        data: imageData,
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp
      };
    } catch (error) {
      console.error('Screen capture failed:', error);
      throw new Error(`Screen capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async captureRegion(options: { x: number; y: number; width: number; height: number }): Promise<Screenshot> {
    if (!this.isInitialized || !this.unifiedCapture) {
      throw new Error('Screen capture not initialized');
    }

    try {
      const screenshot = await this.unifiedCapture.captureRegion(options);
      
      // Ensure data is in the correct format
      let imageData = screenshot.data;
      if (!imageData.startsWith('data:image/')) {
        imageData = `data:image/png;base64,${imageData}`;
      }

      return {
        data: imageData,
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp
      };
    } catch (error) {
      console.error('Region capture failed:', error);
      throw new Error(`Region capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getCapabilities(): ScreenCaptureCapabilities {
    if (!this.unifiedCapture) {
      return {
        supported: false,
        environment: this.isElectron ? 'electron' : 'browser',
        canCaptureScreen: false,
        canCaptureRegion: false,
        canCaptureWindow: false,
        requiresPermission: true
      };
    }

    const caps = this.unifiedCapture.getCapabilities();
    return {
      supported: caps.supported,
      environment: this.isElectron ? 'electron' : 'browser',
      canCaptureScreen: 'canCaptureScreen' in caps ? caps.canCaptureScreen : false,
      canCaptureRegion: 'canCaptureRegion' in caps ? caps.canCaptureRegion : false,
      canCaptureWindow: 'canCaptureWindow' in caps ? caps.canCaptureWindow : false,
      requiresPermission: caps.requiresPermission
    };
  }

  getEnvironment(): 'electron' | 'browser' {
    return this.isElectron ? 'electron' : 'browser';
  }

  isElectronEnvironment(): boolean {
    return this.isElectron;
  }

  async cleanup(): Promise<void> {
    if (this.unifiedCapture) {
      await this.unifiedCapture.cleanup();
      this.unifiedCapture = null;
    }
    this.isInitialized = false;
  }

  // Test method to verify screen capture is working
  async testCapture(): Promise<{ success: boolean; error?: string; screenshot?: Screenshot }> {
    try {
      const screenshot = await this.captureScreen({ test: true });
      return {
        success: true,
        screenshot
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export singleton instance
export const screenCaptureManager = ScreenCaptureManager.getInstance();

// Convenience functions
export async function initializeScreenCapture(): Promise<void> {
  return screenCaptureManager.initialize();
}

export async function captureScreen(options?: any): Promise<Screenshot> {
  return screenCaptureManager.captureScreen(options);
}

export async function captureRegion(options: { x: number; y: number; width: number; height: number }): Promise<Screenshot> {
  return screenCaptureManager.captureRegion(options);
}

export async function isScreenCaptureSupported(): Promise<boolean> {
  return screenCaptureManager.isSupported();
}

export function getScreenCaptureCapabilities(): ScreenCaptureCapabilities {
  return screenCaptureManager.getCapabilities();
}

export function getScreenCaptureEnvironment(): 'electron' | 'browser' {
  return screenCaptureManager.getEnvironment();
}

export async function testScreenCapture(): Promise<{ success: boolean; error?: string; screenshot?: Screenshot }> {
  return screenCaptureManager.testCapture();
}

// Auto-initialize when imported (but don't throw on failure)
if (typeof window !== 'undefined') {
  initializeScreenCapture().catch(error => {
    console.warn('Auto-initialization of screen capture failed:', error);
  });
}
