import { EventEmitter } from 'eventemitter3';
import {
  ModelProvider,
  ModelConfig,
  ModelResponse,
  Action,
  ValidationResult,
  Screenshot,
  ExecutionContext,
  ModelError
} from '../types';

export interface AIModel {
  readonly provider: ModelProvider;
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;

  initialize(config: ModelConfig): Promise<void>;
  analyze(image: Buffer, instruction: string, context?: ExecutionContext): Promise<ModelResponse>;
  generateActions(context: AnalysisContext): Promise<Action[]>;
  validateAction(action: Action, context?: ExecutionContext): Promise<ValidationResult>;
  cleanup(): Promise<void>;

  // Event handling
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export interface AnalysisContext {
  instruction: string;
  screenshot: Screenshot;
  previousActions?: Action[];
  environment?: Record<string, any>;
  constraints?: string[];
}

export abstract class BaseModel extends EventEmitter implements AIModel {
  protected _isInitialized = false;
  protected _config?: ModelConfig;

  constructor(
    public readonly provider: ModelProvider,
    public readonly name: string,
    public readonly version: string
  ) {
    super();
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(config: ModelConfig): Promise<void> {
    if (this._isInitialized) {
      throw new ModelError('Model is already initialized');
    }

    try {
      this._config = config;
      await this.onInitialize(config);
      this._isInitialized = true;
      this.emit('initialized', { config });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Failed to initialize model: ${errorMessage}`, { error });
    }
  }

  async analyze(
    image: Buffer, 
    instruction: string, 
    context?: ExecutionContext
  ): Promise<ModelResponse> {
    if (!this._isInitialized) {
      throw new ModelError('Model is not initialized');
    }

    this.emit('analysis-started', { instruction, context });

    try {
      const response = await this.onAnalyze(image, instruction, context);
      this.emit('analysis-completed', { instruction, response });
      return response;
    } catch (error) {
      this.emit('analysis-failed', { instruction, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Analysis failed: ${errorMessage}`, { error, instruction });
    }
  }

  async generateActions(context: AnalysisContext): Promise<Action[]> {
    if (!this._isInitialized) {
      throw new ModelError('Model is not initialized');
    }

    this.emit('action-generation-started', { context });

    try {
      const actions = await this.onGenerateActions(context);
      this.emit('action-generation-completed', { context, actions });
      return actions;
    } catch (error) {
      this.emit('action-generation-failed', { context, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Action generation failed: ${errorMessage}`, { error, context });
    }
  }

  async validateAction(action: Action, context?: ExecutionContext): Promise<ValidationResult> {
    if (!this._isInitialized) {
      throw new ModelError('Model is not initialized');
    }

    try {
      const result = await this.onValidateAction(action, context);
      this.emit('action-validated', { action, result });
      return result;
    } catch (error) {
      this.emit('action-validation-failed', { action, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Action validation failed: ${errorMessage}`, { error, action });
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
      throw new ModelError(`Failed to cleanup model: ${errorMessage}`, { error });
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(config: ModelConfig): Promise<void>;
  protected abstract onAnalyze(
    image: Buffer, 
    instruction: string, 
    context?: ExecutionContext
  ): Promise<ModelResponse>;
  protected abstract onGenerateActions(context: AnalysisContext): Promise<Action[]>;
  protected abstract onValidateAction(
    action: Action, 
    context?: ExecutionContext
  ): Promise<ValidationResult>;
  protected abstract onCleanup(): Promise<void>;

  // Utility methods
  protected getConfig(): ModelConfig {
    if (!this._config) {
      throw new ModelError('Model is not initialized');
    }
    return this._config;
  }

  protected createAction(type: string, parameters: Record<string, any>, description?: string): Action {
    return {
      id: this.generateId(),
      type: type as any,
      parameters,
      timestamp: Date.now(),
      description
    };
  }

  protected createValidationResult(
    valid: boolean,
    errors: string[] = [],
    warnings: string[] = [],
    suggestions: string[] = []
  ): ValidationResult {
    return {
      valid,
      errors,
      warnings,
      suggestions
    };
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.emit('log', { level, message, data, timestamp: Date.now() });
  }

  // Helper methods for common validations
  protected validateImageFormat(image: Buffer): boolean {
    // Check for PNG signature
    if (image.length >= 8) {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      if (image.subarray(0, 8).equals(pngSignature)) {
        return true;
      }
    }

    // Check for JPEG signature
    if (image.length >= 2) {
      if (image[0] === 0xFF && image[1] === 0xD8) {
        return true;
      }
    }

    return false;
  }

  protected validateInstruction(instruction: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!instruction || instruction.trim().length === 0) {
      errors.push('Instruction cannot be empty');
    }

    if (instruction.length > 1000) {
      warnings.push('Instruction is very long and may not be processed effectively');
    }

    return this.createValidationResult(errors.length === 0, errors, warnings);
  }

  // Rate limiting helpers
  protected async withRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    // Basic rate limiting implementation
    // Subclasses can override for more sophisticated rate limiting
    return operation();
  }

  // Error handling helpers
  protected handleApiError(error: any): ModelError {
    if (error.response) {
      // HTTP error
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      return new ModelError(`API error (${status}): ${message}`, { 
        status, 
        response: error.response.data 
      });
    } else if (error.request) {
      // Network error
      return new ModelError('Network error: Unable to reach the API', { 
        request: error.request 
      });
    } else {
      // Other error
      return new ModelError(`Unexpected error: ${error.message}`, { error });
    }
  }
}
