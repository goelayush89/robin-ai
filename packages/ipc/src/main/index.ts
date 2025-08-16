// Main process IPC implementation
import { ipcMain as electronIpcMain, BrowserWindow } from 'electron';
import type { IPCRoutes, IPCRouteKey, IPCRouteInput, IPCRouteOutput, IPCEvents, IPCEventKey } from '../types';

export class IPCMainHandler {
  private handlers = new Map<string, (input: any) => Promise<any>>();
  private windows = new Set<BrowserWindow>();

  constructor() {
    this.setupIPC();
  }

  private setupIPC(): void {
    // Handle IPC calls from renderer
    electronIpcMain.handle('ipc:call', async (event: any, route: string, input: any) => {
      try {
        const handler = this.handlers.get(route);
        if (!handler) {
          throw new Error(`No handler registered for route: ${route}`);
        }
        return await handler(input);
      } catch (error) {
        console.error(`IPC call failed for route ${route}:`, error);
        throw error;
      }
    });

    // Register window for events
    electronIpcMain.on('ipc:register-window', (event: any) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        this.windows.add(window);

        // Clean up when window is closed
        window.on('closed', () => {
          this.windows.delete(window);
        });
      }
    });
  }

  // Register a handler for a specific route
  public handle<T extends IPCRouteKey>(
    route: T,
    handler: (input: IPCRouteInput<T>) => Promise<IPCRouteOutput<T>>
  ): void {
    this.handlers.set(route, handler);
  }

  // Emit an event to all registered windows
  public emit<T extends IPCEventKey>(
    event: T,
    payload: IPCEvents[T]
  ): void {
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('ipc:event', event, payload);
      }
    });
  }

  // Remove a handler
  public removeHandler(route: string): void {
    this.handlers.delete(route);
  }

  // Get all registered routes
  public getRegisteredRoutes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
export const robinIpcMain = new IPCMainHandler();

// Convenience function to create typed handlers
export function createIPCHandler() {
  return {
    handle: robinIpcMain.handle.bind(robinIpcMain),
    emit: robinIpcMain.emit.bind(robinIpcMain),
    removeHandler: robinIpcMain.removeHandler.bind(robinIpcMain),
    getRegisteredRoutes: robinIpcMain.getRegisteredRoutes.bind(robinIpcMain)
  };
}
