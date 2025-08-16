import { EventEmitter } from 'eventemitter3';
import {
  AgentConfig,
  AgentStatus,
  AgentCapability,
  ExecutionContext,
  Action,
  ActionResult,
  Message,
  Screenshot,
  AgentError,
  AgentEvent
} from '../types';

export interface RobinAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: AgentCapability[];
  readonly status: AgentStatus;

  initialize(config: AgentConfig): Promise<void>;
  execute(instruction: string, context: ExecutionContext): Promise<ActionResult[]>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): AgentStatus;
  getCapabilities(): AgentCapability[];
  
  // Event handling
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export abstract class BaseAgent extends EventEmitter implements RobinAgent {
  protected _status: AgentStatus = AgentStatus.IDLE;
  protected _config?: AgentConfig;
  protected _isInitialized = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly capabilities: AgentCapability[]
  ) {
    super();
  }

  get status(): AgentStatus {
    return this._status;
  }

  protected setStatus(status: AgentStatus): void {
    const previousStatus = this._status;
    this._status = status;
    this.emit('status-changed', { previous: previousStatus, current: status });
  }

  protected emitEvent(type: string, payload: any): void {
    const event: AgentEvent = {
      type,
      payload,
      timestamp: Date.now()
    };
    this.emit('event', event);
    this.emit(type, payload);
  }

  async initialize(config: AgentConfig): Promise<void> {
    if (this._isInitialized) {
      throw new AgentError('Agent is already initialized');
    }

    this.setStatus(AgentStatus.INITIALIZING);
    
    try {
      this._config = config;
      await this.onInitialize(config);
      this._isInitialized = true;
      this.setStatus(AgentStatus.IDLE);
      this.emitEvent('initialized', { config });
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to initialize agent: ${errorMessage}`, { error });
    }
  }

  async execute(instruction: string, context: ExecutionContext): Promise<ActionResult[]> {
    if (!this._isInitialized) {
      throw new AgentError('Agent is not initialized');
    }

    if (this._status !== AgentStatus.IDLE && this._status !== AgentStatus.PAUSED) {
      throw new AgentError(`Cannot execute in current status: ${this._status}`);
    }

    this.setStatus(AgentStatus.RUNNING);
    this.emitEvent('execution-started', { instruction, context });

    try {
      const results = await this.onExecute(instruction, context);
      this.setStatus(AgentStatus.IDLE);
      this.emitEvent('execution-completed', { instruction, results });
      return results;
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);
      this.emitEvent('execution-failed', { instruction, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Execution failed: ${errorMessage}`, { error, instruction });
    }
  }

  async pause(): Promise<void> {
    if (this._status !== AgentStatus.RUNNING) {
      throw new AgentError(`Cannot pause in current status: ${this._status}`);
    }

    try {
      await this.onPause();
      this.setStatus(AgentStatus.PAUSED);
      this.emitEvent('paused', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to pause: ${errorMessage}`, { error });
    }
  }

  async resume(): Promise<void> {
    if (this._status !== AgentStatus.PAUSED) {
      throw new AgentError(`Cannot resume in current status: ${this._status}`);
    }

    try {
      await this.onResume();
      this.setStatus(AgentStatus.RUNNING);
      this.emitEvent('resumed', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to resume: ${errorMessage}`, { error });
    }
  }

  async stop(): Promise<void> {
    if (this._status === AgentStatus.STOPPED) {
      return;
    }

    try {
      await this.onStop();
      this.setStatus(AgentStatus.STOPPED);
      this.emitEvent('stopped', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to stop: ${errorMessage}`, { error });
    }
  }

  getStatus(): AgentStatus {
    return this._status;
  }

  getCapabilities(): AgentCapability[] {
    return [...this.capabilities];
  }

  protected getConfig(): AgentConfig {
    if (!this._config) {
      throw new AgentError('Agent is not initialized');
    }
    return this._config;
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(config: AgentConfig): Promise<void>;
  protected abstract onExecute(instruction: string, context: ExecutionContext): Promise<ActionResult[]>;
  protected abstract onPause(): Promise<void>;
  protected abstract onResume(): Promise<void>;
  protected abstract onStop(): Promise<void>;

  // Utility methods
  protected createAction(type: string, parameters: Record<string, any>, description?: string): Action {
    return {
      id: this.generateId(),
      type: type as any,
      parameters,
      timestamp: Date.now(),
      description
    };
  }

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

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.emitEvent('log', { level, message, data, timestamp: Date.now() });
  }
}
