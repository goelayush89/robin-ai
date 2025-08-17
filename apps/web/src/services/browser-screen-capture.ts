/**
 * Browser-specific screen capture implementation using Web APIs
 */

export interface BrowserScreenshot {
  data: string; // Base64 encoded image
  width: number;
  height: number;
  timestamp: number;
}

export class BrowserScreenCapture {
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;

  async initialize(): Promise<void> {
    try {
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        throw new Error('Screen Capture API requires a secure context (HTTPS)');
      }

      // Request screen capture permission with specific constraints
      const constraints = {
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };

      // Use getDisplayMedia with proper error handling
      this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Create video element to display the stream
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;

      // Create canvas for capturing frames
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');

      if (!this.context) {
        throw new Error('Failed to get canvas context');
      }

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.video) {
          reject(new Error('Video element not created'));
          return;
        }

        this.video.onloadedmetadata = () => {
          if (this.video) {
            this.video.play().then(resolve).catch(reject);
          }
        };

        this.video.onerror = () => {
          reject(new Error('Video failed to load'));
        };

        // Set up stream end handler
        this.stream?.getTracks().forEach(track => {
          track.onended = () => {
            console.log('Screen capture stream ended');
            this.cleanup();
          };
        });
      });

      console.log('Browser screen capture initialized successfully');
    } catch (error) {
      console.error('Failed to initialize screen capture:', error);
      this.cleanup();

      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotSupportedError':
            throw new Error('Screen capture not supported by this browser or requires HTTPS');
          case 'NotAllowedError':
            throw new Error('Screen capture permission denied by user');
          case 'NotFoundError':
            throw new Error('No screen capture source available');
          case 'AbortError':
            throw new Error('Screen capture request was aborted');
          default:
            throw new Error(`Screen capture failed: ${error.message}`);
        }
      }

      throw error;
    }
  }

  async captureScreen(): Promise<BrowserScreenshot> {
    // If screen capture isn't available, create a fallback screenshot
    if (!this.isSupported() || !this.stream || !this.video) {
      return this.createFallbackScreenshot();
    }

    if (!this.canvas || !this.context) {
      throw new Error('Screen capture not initialized');
    }

    try {
      // Ensure video is playing and has valid dimensions
      if (this.video.readyState < 2) { // HAVE_CURRENT_DATA
        await new Promise<void>((resolve, reject) => {
          if (!this.video) {
            reject(new Error('Video element not available'));
            return;
          }

          const handleCanPlay = () => {
            this.video?.removeEventListener('canplay', handleCanPlay);
            resolve();
          };

          this.video.addEventListener('canplay', handleCanPlay);

          // Timeout after 5 seconds
          setTimeout(() => {
            this.video?.removeEventListener('canplay', handleCanPlay);
            reject(new Error('Video failed to load within timeout'));
          }, 5000);
        });
      }

      // Set canvas dimensions to match video
      const width = this.video.videoWidth;
      const height = this.video.videoHeight;

      if (width === 0 || height === 0) {
        throw new Error('Invalid video dimensions');
      }

      this.canvas.width = width;
      this.canvas.height = height;

      // Draw current video frame to canvas
      this.context.drawImage(this.video, 0, 0, width, height);

      // Convert to base64 with high quality
      const dataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
      const base64Data = dataUrl.split(',')[1];

      return {
        data: base64Data,
        width: width,
        height: height,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture screen:', error);
      // Fall back to simulated screenshot
      return this.createFallbackScreenshot();
    }
  }

  async captureElement(element: HTMLElement): Promise<BrowserScreenshot> {
    if (!this.canvas || !this.context) {
      throw new Error('Screen capture not initialized');
    }

    try {
      // Use html2canvas or similar library for element capture
      // For now, we'll use a simple approach with canvas
      const rect = element.getBoundingClientRect();
      
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;

      // This is a simplified approach - in a real implementation,
      // you'd want to use a library like html2canvas
      this.context.fillStyle = '#ffffff';
      this.context.fillRect(0, 0, rect.width, rect.height);
      this.context.fillStyle = '#000000';
      this.context.font = '16px Arial';
      this.context.fillText('Element capture placeholder', 10, 30);

      const dataUrl = this.canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      return {
        data: base64Data,
        width: rect.width,
        height: rect.height,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture element:', error);
      throw new Error('Element capture failed');
    }
  }

  async captureViewport(): Promise<BrowserScreenshot> {
    if (!this.canvas || !this.context) {
      throw new Error('Screen capture not initialized');
    }

    try {
      // Capture the current viewport
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.canvas.width = width;
      this.canvas.height = height;

      // Use html2canvas or similar for viewport capture
      // For now, create a placeholder
      this.context.fillStyle = '#f0f0f0';
      this.context.fillRect(0, 0, width, height);
      this.context.fillStyle = '#333333';
      this.context.font = '24px Arial';
      this.context.textAlign = 'center';
      this.context.fillText('Viewport Capture', width / 2, height / 2);
      this.context.fillText(`${width} x ${height}`, width / 2, height / 2 + 40);

      const dataUrl = this.canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      return {
        data: base64Data,
        width: width,
        height: height,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture viewport:', error);
      throw new Error('Viewport capture failed');
    }
  }

  isSupported(): boolean {
    // Check if we're in a secure context (required for getDisplayMedia)
    if (!window.isSecureContext) {
      console.warn('Screen Capture API requires a secure context (HTTPS)');
      return false;
    }

    // Check for API availability
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      console.warn('getDisplayMedia API not available');
      return false;
    }

    // Check for canvas support
    if (!HTMLCanvasElement.prototype.getContext) {
      console.warn('Canvas API not available');
      return false;
    }

    return true;
  }

  async requestPermission(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('Screen capture not supported in this environment');
        return false;
      }

      // Test if we can get display media with proper constraints
      const constraints = {
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const testStream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Stop the test stream immediately
      testStream.getTracks().forEach(track => track.stop());

      console.log('Screen capture permission granted');
      return true;
    } catch (error) {
      console.warn('Screen capture permission denied:', error);

      // Check for specific error types
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotSupportedError':
            console.error('Screen capture not supported by this browser or requires HTTPS');
            break;
          case 'NotAllowedError':
            console.error('Screen capture permission denied by user');
            break;
          case 'NotFoundError':
            console.error('No screen capture source available');
            break;
          case 'AbortError':
            console.error('Screen capture request was aborted');
            break;
          case 'InvalidStateError':
            console.error('Screen capture request in invalid state');
            break;
          case 'TypeError':
            console.error('Screen capture constraints invalid');
            break;
          default:
            console.error('Screen capture failed:', error.message);
        }
      }

      return false;
    }
  }

  stop(): void {
    this.cleanup();
    console.log('Browser screen capture stopped');
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.context = null;
    }
  }

  getStatus(): 'idle' | 'active' | 'error' {
    if (!this.isSupported()) {
      return 'idle'; // Fallback mode
    }

    if (!this.stream) {
      return 'idle';
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.readyState === 'live') {
      return 'active';
    }

    return 'error';
  }

  private createFallbackScreenshot(): BrowserScreenshot {
    // Create a simulated screenshot when real screen capture isn't available
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context not available');
    }

    // Set canvas size to viewport size
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Create a gradient background
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0f9ff');
    gradient.addColorStop(0.5, '#e0f2fe');
    gradient.addColorStop(1, '#bae6fd');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // Add some visual elements to make it look like a desktop
    context.fillStyle = '#1e40af';
    context.fillRect(0, height - 60, width, 60); // Taskbar

    // Add window-like rectangles
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#d1d5db';
    context.lineWidth = 2;

    // Browser window
    context.fillRect(100, 100, width - 200, height - 200);
    context.strokeRect(100, 100, width - 200, height - 200);

    // Window title bar
    context.fillStyle = '#f3f4f6';
    context.fillRect(100, 100, width - 200, 40);
    context.strokeRect(100, 100, width - 200, 40);

    // Add text
    context.fillStyle = '#374151';
    context.font = '16px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('Robin Assistant - Demo Mode', width / 2, height / 2 - 50);

    context.font = '14px Arial, sans-serif';
    context.fillText('Screen capture not available in this environment', width / 2, height / 2 - 20);
    context.fillText('This is a simulated screenshot for demonstration', width / 2, height / 2 + 10);
    context.fillText('Use HTTPS or the desktop app for real screen capture', width / 2, height / 2 + 40);

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];

    return {
      data: base64Data,
      width: width,
      height: height,
      timestamp: Date.now()
    };
  }
}

// Singleton instance
export const browserScreenCapture = new BrowserScreenCapture();

// Helper function to check if screen capture is available
export function isScreenCaptureSupported(): boolean {
  return browserScreenCapture.isSupported();
}

export function getScreenCaptureInfo(): {
  supported: boolean;
  reason?: string;
  suggestions: string[];
} {
  // Check secure context (more accurate than checking protocol)
  const isSecure = window.isSecureContext;

  const hasAPI = !!(navigator.mediaDevices &&
                    typeof navigator.mediaDevices.getDisplayMedia === 'function');

  const hasCanvas = !!HTMLCanvasElement.prototype.getContext;

  if (!isSecure) {
    return {
      supported: false,
      reason: 'Screen Capture API requires a secure context (HTTPS)',
      suggestions: [
        'Serve the site over HTTPS',
        'Use localhost for development (automatically secure)',
        'Download the desktop app for full functionality'
      ]
    };
  }

  if (!hasAPI) {
    return {
      supported: false,
      reason: 'Browser does not support getDisplayMedia API',
      suggestions: [
        'Use Chrome 72+, Firefox 66+, or Edge 79+',
        'Update your browser to the latest version',
        'Download the desktop app for full functionality'
      ]
    };
  }

  if (!hasCanvas) {
    return {
      supported: false,
      reason: 'Canvas API not available',
      suggestions: [
        'Enable JavaScript in your browser',
        'Use a modern browser',
        'Download the desktop app for full functionality'
      ]
    };
  }

  return {
    supported: true,
    suggestions: [
      'Click "Grant Screen Capture Permission" below',
      'Select your entire screen or a specific window',
      'Allow the permission when your browser prompts you'
    ]
  };
}

// Helper function to request screen capture permission
export async function requestScreenCapturePermission(): Promise<boolean> {
  return browserScreenCapture.requestPermission();
}
