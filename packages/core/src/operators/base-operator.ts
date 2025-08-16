import { EventEmitter } from 'eventemitter3';
import {
  OperatorType,
  OperatorCapability,
  Action,
  ActionResult,
  Screenshot,
  Point,
  Rectangle,
  OperatorError
} from '../types';

export interface SystemOperator {
  readonly type: OperatorType;
  readonly capabilities: OperatorCapability[];
  readonly isInitialized: boolean;

  initialize(config?: Record<string, any>): Promise<void>;
  execute(action: Action): Promise<ActionResult>;
  capture(): Promise<Screenshot>;
  cleanup(): Promise<void>;
  
  // Event handling
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export abstract class BaseOperator extends EventEmitter implements SystemOperator {
  protected _isInitialized = false;
  protected _config?: Record<string, any>;

  constructor(
    public readonly type: OperatorType,
    public readonly capabilities: OperatorCapability[]
  ) {
    super();
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(config?: Record<string, any>): Promise<void> {
    if (this._isInitialized) {
      throw new OperatorError('Operator is already initialized');
    }

    try {
      this._config = config || {};
      await this.onInitialize(this._config);
      this._isInitialized = true;
      this.emit('initialized', { config: this._config });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to initialize operator: ${errorMessage}`, { error });
    }
  }

  async execute(action: Action): Promise<ActionResult> {
    if (!this._isInitialized) {
      throw new OperatorError('Operator is not initialized');
    }

    // Check if action is supported
    const capability = this.capabilities.find(cap => cap.action === action.type);
    if (!capability || !capability.supported) {
      throw new OperatorError(`Action type '${action.type}' is not supported by this operator`);
    }

    this.emit('action-started', { action });

    try {
      const result = await this.onExecute(action);
      this.emit('action-completed', { action, result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResult: ActionResult = {
        actionId: action.id,
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
      this.emit('action-failed', { action, error });
      return errorResult;
    }
  }

  async capture(): Promise<Screenshot> {
    if (!this._isInitialized) {
      throw new OperatorError('Operator is not initialized');
    }

    try {
      const screenshot = await this.onCapture();
      this.emit('screenshot-captured', { screenshot });
      return screenshot;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to capture screenshot: ${errorMessage}`, { error });
    }
  }

  async cleanup(): Promise<void> {
    if (!this._isInitialized) {
      return;
    }

    try {
      await this.onCleanup();
      this._isInitialized = false;
      this.emit('cleaned-up', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to cleanup operator: ${errorMessage}`, { error });
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(config: Record<string, any>): Promise<void>;
  protected abstract onExecute(action: Action): Promise<ActionResult>;
  protected abstract onCapture(): Promise<Screenshot>;
  protected abstract onCleanup(): Promise<void>;

  // Utility methods
  protected createActionResult(
    actionId: string,
    success: boolean,
    error?: string,
    data?: any,
    screenshot?: Screenshot
  ): ActionResult {
    return {
      actionId,
      success,
      error,
      data,
      screenshot,
      timestamp: Date.now()
    };
  }

  protected createScreenshot(
    data: Buffer,
    width: number,
    height: number,
    format: 'png' | 'jpeg' = 'png'
  ): Screenshot {
    return {
      id: this.generateId(),
      data,
      width,
      height,
      timestamp: Date.now(),
      format
    };
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected validatePoint(point: Point, bounds?: Rectangle): boolean {
    if (point.x < 0 || point.y < 0) {
      return false;
    }
    
    if (bounds) {
      return point.x >= bounds.x && 
             point.y >= bounds.y && 
             point.x <= bounds.x + bounds.width && 
             point.y <= bounds.y + bounds.height;
    }
    
    return true;
  }

  protected validateRectangle(rect: Rectangle): boolean {
    return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0;
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.emit('log', { level, message, data, timestamp: Date.now() });
  }

  protected getConfig(): Record<string, any> {
    if (!this._config) {
      throw new OperatorError('Operator is not initialized');
    }
    return this._config;
  }

  // Helper method to check if a specific action is supported
  public supportsAction(actionType: string): boolean {
    return this.capabilities.some(cap => cap.action === actionType && cap.supported);
  }

  // Get capability details for a specific action
  public getActionCapability(actionType: string): OperatorCapability | undefined {
    return this.capabilities.find(cap => cap.action === actionType);
  }
}
