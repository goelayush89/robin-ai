// Renderer process IPC implementation
import type { IPCRoutes, IPCRouteKey, IPCRouteInput, IPCRouteOutput, IPCEvents, IPCEventKey } from '../types';

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
    };
  }
}

export class IPCRendererClient {
  private eventListeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor() {
    this.setupEventHandling();
    this.registerWindow();
  }

  private setupEventHandling(): void {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for events from main process
      window.electronAPI.on('ipc:event', (event: string, payload: any) => {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
          listeners.forEach(listener => {
            try {
              listener(payload);
            } catch (error) {
              console.error(`Error in event listener for ${event}:`, error);
            }
          });
        }
      });
    }
  }

  private registerWindow(): void {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.send('ipc:register-window');
    }
  }

  // Call a route on the main process
  public async call<T extends IPCRouteKey>(
    route: T,
    input: IPCRouteInput<T>
  ): Promise<IPCRouteOutput<T>> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      return await window.electronAPI.invoke('ipc:call', route, input);
    } catch (error) {
      console.error(`IPC call failed for route ${route}:`, error);
      throw error;
    }
  }

  // Listen for events from main process
  public on<T extends IPCEventKey>(
    event: T,
    listener: (payload: IPCEvents[T]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  // Remove event listener
  public off<T extends IPCEventKey>(
    event: T,
    listener: (payload: IPCEvents[T]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  // Remove all listeners for an event
  public removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  // Get all registered events
  public getRegisteredEvents(): string[] {
    return Array.from(this.eventListeners.keys());
  }
}

// Singleton instance
export const ipcRenderer = new IPCRendererClient();

// Convenience function to create typed client
export function createIPCClient() {
  return {
    call: ipcRenderer.call.bind(ipcRenderer),
    on: ipcRenderer.on.bind(ipcRenderer),
    off: ipcRenderer.off.bind(ipcRenderer),
    removeAllListeners: ipcRenderer.removeAllListeners.bind(ipcRenderer),
    getRegisteredEvents: ipcRenderer.getRegisteredEvents.bind(ipcRenderer)
  };
}

// React hook for IPC events
export function useIPCEvent<T extends IPCEventKey>(
  event: T,
  listener: (payload: IPCEvents[T]) => void,
  deps: any[] = []
): (() => void) | void {
  if (typeof window !== 'undefined') {
    // This would need React to be available
    // For now, just provide the basic functionality
    ipcRenderer.on(event, listener);

    // Return cleanup function
    return () => {
      ipcRenderer.off(event, listener);
    };
  }
}
