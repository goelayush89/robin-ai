import { desktopCapturer, nativeImage } from 'electron';
import log from 'electron-log';

export interface ScreenshotData {
  success: boolean;
  data?: {
    data: string; // base64 encoded image
    width: number;
    height: number;
    timestamp: number;
  };
  error?: string;
}

export class ScreenshotService {
  private static instance: ScreenshotService;

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  async takeScreenshot(options?: any): Promise<ScreenshotData> {
    try {
      log.info('Taking screenshot with Electron desktopCapturer...');

      // Get available sources (screens and windows)
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: {
          width: options?.width || 1920,
          height: options?.height || 1080
        }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      let selectedSource;

      // If a specific screen ID is provided, find it
      if (options?.screenId) {
        selectedSource = sources.find(source => source.id === options.screenId);
        if (!selectedSource) {
          log.warn(`Screen with ID ${options.screenId} not found. Available sources:`, sources.map(s => s.id));
          // Fallback to first available source
          selectedSource = sources[0];
          if (!selectedSource) {
            throw new Error('No screen sources available');
          }
          log.info(`Using fallback source: ${selectedSource.id}`);
        }
      } else {
        // Use the first screen (primary display)
        selectedSource = sources.find(source => source.id.startsWith('screen:')) || sources[0];
      }

      log.info(`Screenshot captured from: ${selectedSource.name} (${selectedSource.id})`);

      // Get the thumbnail as a native image
      const thumbnail = selectedSource.thumbnail;
      const size = thumbnail.getSize();

      // Convert to PNG buffer and then to base64
      const pngBuffer = thumbnail.toPNG();
      const base64Data = pngBuffer.toString('base64');

      const result: ScreenshotData = {
        success: true,
        data: {
          data: base64Data,
          width: size.width,
          height: size.height,
          timestamp: Date.now()
        }
      };

      log.info(`Screenshot successful: ${size.width}x${size.height}`);
      return result;

    } catch (error) {
      log.error('Screenshot failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async takeRegionScreenshot(options: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<ScreenshotData> {
    try {
      // First take a full screenshot
      const fullScreenshot = await this.takeScreenshot();
      
      if (!fullScreenshot.success || !fullScreenshot.data) {
        return fullScreenshot;
      }

      // Create a native image from the base64 data
      const fullImage = nativeImage.createFromBuffer(
        Buffer.from(fullScreenshot.data.data, 'base64')
      );

      // Crop the image to the specified region
      const croppedImage = fullImage.crop({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height
      });

      // Convert back to base64
      const croppedBuffer = croppedImage.toPNG();
      const base64Data = croppedBuffer.toString('base64');

      return {
        success: true,
        data: {
          data: base64Data,
          width: options.width,
          height: options.height,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      log.error('Region screenshot failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getScreenInfo(): Promise<{
    success: boolean;
    screens?: Array<{
      id: string;
      name: string;
      width: number;
      height: number;
      type: 'screen' | 'window';
    }>;
    error?: string;
  }> {
    try {
      // Try to get both screens and windows; tolerate partial failures
      const results = await Promise.allSettled([
        desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 300, height: 200 }
        }),
        desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 300, height: 200 }
        })
      ]);

      const screenSources = results[0].status === 'fulfilled' ? results[0].value : [];
      const windowSources = results[1].status === 'fulfilled' ? results[1].value : [];

      if (results[0].status === 'rejected') {
        log.warn('Screen sources not available:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        log.warn('Window sources not available:', results[1].reason);
      }

      const screens = [
        ...screenSources.map(source => ({
          id: source.id,
          name: source.name,
          width: source.thumbnail.getSize().width,
          height: source.thumbnail.getSize().height,
          type: 'screen' as const
        })),
        ...windowSources
          .filter(source =>
            // Filter out system windows and empty windows
            !source.name.includes('Task Switching') &&
            !source.name.includes('Program Manager') &&
            !source.name.includes('Desktop Window Manager') &&
            source.name.trim().length > 0
          )
          .map(source => ({
            id: source.id,
            name: `📱 ${source.name}`,
            width: source.thumbnail.getSize().width,
            height: source.thumbnail.getSize().height,
            type: 'window' as const
          }))
      ];

      if (screens.length === 0) {
        return { success: false, error: 'No capturable screens or windows found' };
      }

      log.info(`Found ${screens.length} available screens and windows`);

      return {
        success: true,
        screens
      };

    } catch (error) {
      log.error('Failed to get screen info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  isSupported(): boolean {
    try {
      // Check if desktopCapturer is available
      return typeof desktopCapturer !== 'undefined' && 
             typeof desktopCapturer.getSources === 'function';
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const screenshotService = ScreenshotService.getInstance();
