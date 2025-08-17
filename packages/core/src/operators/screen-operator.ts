import { BaseOperator } from './base-operator';
import {
  OperatorType,
  OperatorCapability,
  Action,
  ActionResult,
  ActionType,
  Screenshot,
  OperatorError
} from '../types';

// Browser environment type declarations for screen capture

export class ScreenOperator extends BaseOperator {
  private screenCapture?: any; // Will be dynamically imported

  constructor() {
    const capabilities: OperatorCapability[] = [
      {
        action: ActionType.SCREENSHOT,
        description: 'Capture screenshot of the current screen',
        supported: true,
        parameters: {
          format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' },
          quality: { type: 'number', min: 1, max: 100, default: 90 }
        }
      }
    ];

    super(OperatorType.LOCAL_COMPUTER, capabilities);
  }

  protected async onInitialize(config: Record<string, any>): Promise<void> {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Browser environment - use web APIs
        this.screenCapture = { type: 'browser' };
        this.log('info', 'Screen operator initialized for browser environment');
        return;
      }

      // Node.js environment - use platform-specific capture
      if (typeof process !== 'undefined') {
        if (process.platform === 'win32') {
          // Use Windows-specific screen capture
          this.screenCapture = await this.initializeWindowsCapture();
        } else if (process.platform === 'darwin') {
          // Use macOS-specific screen capture
          this.screenCapture = await this.initializeMacCapture();
        } else {
          // Use Linux-specific screen capture
          this.screenCapture = await this.initializeLinuxCapture();
        }
        this.log('info', 'Screen operator initialized', { platform: process.platform });
      } else {
        // Fallback for unknown environments
        this.screenCapture = { type: 'fallback' };
        this.log('warn', 'Unknown environment, using fallback screen capture');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to initialize screen capture: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(action: Action): Promise<ActionResult> {
    switch (action.type) {
      case ActionType.SCREENSHOT:
        return await this.captureScreenshot(action);
      default:
        throw new OperatorError(`Unsupported action type: ${action.type}`);
    }
  }

  protected async onCapture(): Promise<Screenshot> {
    try {
      const imageData = await this.captureScreenData();
      return this.createScreenshot(
        imageData.buffer,
        imageData.width,
        imageData.height,
        'png'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to capture screenshot: ${errorMessage}`, { error });
    }
  }

  protected async onCleanup(): Promise<void> {
    this.screenCapture = undefined;
    this.log('info', 'Screen operator cleaned up');
  }

  // Public method for ActionExecutor and other services
  async captureScreen(): Promise<{ data: string; width: number; height: number; timestamp: number }> {
    try {
      const { buffer, width, height } = await this.captureScreenData();
      const base64Data = buffer.toString('base64');

      return {
        data: base64Data,
        width,
        height,
        timestamp: Date.now()
      };
    } catch (error) {
      this.log('error', 'Screen capture failed', { error });
      throw new OperatorError('Failed to capture screen', { error });
    }
  }

  private async captureScreenshot(action: Action): Promise<ActionResult> {
    try {
      const screenshot = await this.onCapture();
      return this.createActionResult(
        action.id,
        true,
        undefined,
        { screenshot },
        screenshot
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createActionResult(
        action.id,
        false,
        errorMessage
      );
    }
  }

  private async captureScreenData(): Promise<{ buffer: Buffer; width: number; height: number }> {
    if (typeof window !== 'undefined') {
      // Browser environment - use HTML5 Screen Capture API
      return await this.captureScreenBrowser();
    } else {
      // Node.js environment - use native screen capture
      return await this.captureScreenNative();
    }
  }

  private async captureScreenBrowser(): Promise<{ buffer: Buffer; width: number; height: number }> {
    try {
      // Use HTML5 Screen Capture API
      const stream = await (navigator as any).mediaDevices.getDisplayMedia({
        video: true
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(video, 0, 0);
          
          // Stop the stream
          stream.getTracks().forEach((track: any) => track.stop());

          // Convert to buffer
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            blob.arrayBuffer().then(arrayBuffer => {
              resolve({
                buffer: Buffer.from(arrayBuffer),
                width: canvas.width,
                height: canvas.height
              });
            }).catch(reject);
          }, 'image/png');
        };
      });
    } catch (error) {
      throw new OperatorError('Browser screen capture failed', { error });
    }
  }

  private async captureScreenNative(): Promise<{ buffer: Buffer; width: number; height: number }> {
    try {
      // Use platform-specific screen capture
      if (process.platform === 'win32') {
        return await this.captureWindows();
      } else if (process.platform === 'darwin') {
        return await this.captureMac();
      } else {
        return await this.captureLinux();
      }
    } catch (error) {
      throw new OperatorError('Native screen capture failed', { error });
    }
  }

  private async initializeWindowsCapture(): Promise<any> {
    // For Windows, we can use node-screenshots or similar
    try {
      // Only try to import in Node.js environment
      if (typeof process !== 'undefined' && typeof window === 'undefined') {
        // Dynamic import with proper error handling - use string concatenation to avoid Vite analysis
        try {
          const packageName = 'node-' + 'screenshots';
          const screenshots = await import(packageName).catch(() => null);
          if (screenshots) {
            return screenshots;
          }
        } catch (importError) {
          this.log('warn', 'node-screenshots import failed', { importError });
        }
      }

      // Fallback to command-line tools
      this.log('warn', 'node-screenshots not available, using command fallback');
      return { type: 'command' };
    } catch (error) {
      // Fallback to other methods
      this.log('warn', 'Windows screen capture initialization failed, using fallback');
      return { type: 'fallback' };
    }
  }

  private async initializeMacCapture(): Promise<any> {
    // For macOS, we can use screencapture command or native bindings
    try {
      if (typeof process !== 'undefined' && typeof window === 'undefined') {
        const moduleName = 'child_' + 'process';
        const { exec } = await import(moduleName);
        return { exec, type: 'command' };
      }
      return { type: 'fallback' };
    } catch (error) {
      this.log('warn', 'Failed to initialize macOS screen capture, using fallback', { error });
      return { type: 'fallback' };
    }
  }

  private async initializeLinuxCapture(): Promise<any> {
    // For Linux, we can use scrot, gnome-screenshot, or X11 bindings
    try {
      if (typeof process !== 'undefined' && typeof window === 'undefined') {
        const moduleName = 'child_' + 'process';
        const { exec } = await import(moduleName);
        return { exec, type: 'command' };
      }
      return { type: 'fallback' };
    } catch (error) {
      this.log('warn', 'Failed to initialize Linux screen capture, using fallback', { error });
      return { type: 'fallback' };
    }
  }

  private async captureWindows(): Promise<{ buffer: Buffer; width: number; height: number }> {
    if (this.screenCapture) {
      try {
        // If we have the node-screenshots library
        if (this.screenCapture.captureScreen) {
          const image = await this.screenCapture.captureScreen();
          return {
            buffer: image.buffer,
            width: image.width,
            height: image.height
          };
        }

        // Fallback to command-line method
        if (this.screenCapture.type === 'command') {
          return await this.captureWithCommand('powershell', [
            '-Command',
            'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds'
          ]);
        }
      } catch (error) {
        this.log('warn', 'Windows screen capture failed, trying fallback', { error });
      }
    }

    throw new OperatorError('Windows screen capture not available');
  }

  private async captureMac(): Promise<{ buffer: Buffer; width: number; height: number }> {
    return await this.captureWithCommand('screencapture', ['-t', 'png', '-']);
  }

  private async captureLinux(): Promise<{ buffer: Buffer; width: number; height: number }> {
    // Try different Linux screenshot tools
    const tools = [
      { cmd: 'gnome-screenshot', args: ['-f', '/dev/stdout'] },
      { cmd: 'scrot', args: ['-'] },
      { cmd: 'import', args: ['-window', 'root', 'png:-'] }
    ];

    for (const tool of tools) {
      try {
        return await this.captureWithCommand(tool.cmd, tool.args);
      } catch (error) {
        this.log('warn', `Failed to use ${tool.cmd}`, { error });
        continue;
      }
    }

    throw new OperatorError('No suitable Linux screen capture tool found');
  }

  private async captureWithCommand(
    command: string,
    args: string[]
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    // Only available in Node.js environment
    if (typeof window !== 'undefined') {
      throw new OperatorError('Command-line screen capture not available in browser environment');
    }

    return new Promise(async (resolve, reject) => {
      try {
        const moduleName = 'child_' + 'process';
        const { spawn } = await import(moduleName);
        const process = spawn(command, args);

        const chunks: Buffer[] = [];

        process.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        process.on('close', (code: number) => {
          if (code === 0) {
            const buffer = Buffer.concat(chunks);
            // For now, return default dimensions - in a real implementation,
            // we would parse the image to get actual dimensions
            resolve({
              buffer,
              width: 1920, // Default width
              height: 1080 // Default height
            });
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });

        process.on('error', reject);
      } catch (error) {
        reject(new OperatorError('Failed to execute screen capture command', { error }));
      }
    });
  }
}
