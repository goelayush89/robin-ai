import { BaseAgent } from './base-agent';
import { ScreenOperator } from '../operators/screen-operator';
import { InputOperator } from '../operators/input-operator';
import { OpenAIVisionModel } from '../models/openai-vision-model';
import { AnthropicClaudeModel } from '../models/anthropic-claude-model';
import { OpenRouterModel } from '../models/openrouter-model';
import { AIVisionService } from '../services/ai-vision-service';
import { ActionExecutor } from '../services/action-executor';
import { SessionManager } from '../services/session-manager';
import {
  AgentConfig,
  AgentCapability,
  ExecutionContext,
  ActionResult,
  ActionType,
  ModelProvider,
  OperatorType,
  AgentError,
  Screenshot,
  Action
} from '../types';

export class LocalComputerAgent extends BaseAgent {
  private screenOperator?: ScreenOperator;
  private inputOperator?: InputOperator;
  private model?: any; // AIModel interface
  private aiVisionService?: AIVisionService;
  private actionExecutor?: ActionExecutor;
  private sessionManager?: SessionManager;
  private maxIterations = 10;
  private iterationDelay = 1000;

  constructor() {
    const capabilities: AgentCapability[] = [
      {
        name: 'Screen Analysis',
        description: 'Analyze screenshots and understand UI elements',
        supported: true,
        requirements: ['Vision model', 'Screen capture']
      },
      {
        name: 'Mouse Control',
        description: 'Click, drag, and scroll using mouse',
        supported: true,
        requirements: ['Input operator']
      },
      {
        name: 'Keyboard Control',
        description: 'Type text and press keyboard shortcuts',
        supported: true,
        requirements: ['Input operator']
      },
      {
        name: 'Multi-step Tasks',
        description: 'Execute complex tasks with multiple steps',
        supported: true,
        requirements: ['Vision model', 'All operators']
      },
      {
        name: 'Error Recovery',
        description: 'Detect and recover from errors',
        supported: true,
        requirements: ['Vision model']
      }
    ];

    super(
      'local-computer-agent',
      'Local Computer Agent',
      'AI agent for controlling local computer through GUI automation',
      capabilities
    );
  }

  protected async onInitialize(config: AgentConfig): Promise<void> {
    try {
      // Initialize operators
      this.screenOperator = new ScreenOperator();
      await this.screenOperator.initialize(config.operator.settings);

      this.inputOperator = new InputOperator();
      await this.inputOperator.initialize(config.operator.settings);

      // Initialize AI model
      await this.initializeModel(config);

      // Initialize services
      this.aiVisionService = new AIVisionService();
      await this.aiVisionService.initialize({
        provider: config.model.provider,
        apiKey: config.model.apiKey,
        model: config.model.name,
        maxTokens: 2000,
        temperature: 0.1
      });

      this.actionExecutor = new ActionExecutor(this.screenOperator, this.inputOperator);
      this.sessionManager = new SessionManager();

      // Set agent settings
      this.maxIterations = config.settings.maxIterations || 10;
      this.iterationDelay = config.settings.iterationDelay || 1000;

      this.log('info', 'Local computer agent initialized successfully with real automation capabilities');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to initialize local computer agent: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(instruction: string, context: ExecutionContext): Promise<ActionResult[]> {
    if (!this.aiVisionService || !this.actionExecutor || !this.sessionManager) {
      throw new AgentError('Services not initialized');
    }

    const sessionId = this.sessionManager.createSession(instruction);
    const results: ActionResult[] = [];
    let currentIteration = 0;
    let lastScreenshot: Screenshot | undefined;

    try {
      this.log('info', 'Starting real automation execution', { instruction, maxIterations: this.maxIterations, sessionId });

      while (currentIteration < this.maxIterations) {
        currentIteration++;
        this.emitEvent('iteration-started', { iteration: currentIteration, instruction, sessionId });

        // Capture current screen state
        if (!this.screenOperator) {
          throw new AgentError('Screen operator not initialized');
        }

        lastScreenshot = await this.screenOperator.capture();
        this.emitEvent('screenshot-captured', { screenshot: lastScreenshot, iteration: currentIteration });

        // Add screenshot result
        const screenshotResult = this.createActionResult(
          `screenshot-${currentIteration}`,
          true,
          undefined,
          {
            action: 'screenshot',
            iteration: currentIteration,
            screenshot: {
              width: lastScreenshot.width,
              height: lastScreenshot.height,
              timestamp: lastScreenshot.timestamp
            }
          }
        );
        results.push(screenshotResult);

        // Use AI Vision Service for analysis
        const analysis = await this.aiVisionService.analyzeScreenshot(
          lastScreenshot,
          instruction,
          currentIteration,
          results
        );

        this.emitEvent('analysis-completed', {
          analysis,
          iteration: currentIteration,
          reasoning: analysis.reasoning,
          confidence: analysis.confidence
        });

        // Add analysis result
        const analysisResult = this.createActionResult(
          `analysis-${currentIteration}`,
          true,
          undefined,
          {
            action: 'ai_analysis',
            iteration: currentIteration,
            reasoning: analysis.reasoning,
            confidence: analysis.confidence,
            isComplete: analysis.isComplete,
            nextActions: analysis.actions.map(a => ({ type: a.type, reasoning: a.reasoning }))
          }
        );
        results.push(analysisResult);

        // Check if task is complete
        if (analysis.isComplete) {
          this.log('info', 'Task completed successfully', { iteration: currentIteration });
          const completionResult = this.createActionResult(
            `completion-${currentIteration}`,
            true,
            undefined,
            {
              action: 'task_complete',
              iteration: currentIteration,
              message: 'Task completed successfully',
              finalReasoning: analysis.reasoning
            }
          );
          results.push(completionResult);
          break;
        }

        if (!analysis.actions || analysis.actions.length === 0) {
          this.log('warn', 'No actions generated by AI', { iteration: currentIteration });
          break;
        }

        // Execute each action using ActionExecutor
        for (const action of analysis.actions) {
          this.emitEvent('action-started', { action, iteration: currentIteration });

          try {
            // Execute the action using ActionExecutor
            const executionResult = await this.actionExecutor.executeAction(action);

            const actionResult = this.createActionResult(
              action.id,
              executionResult.success,
              executionResult.error,
              {
                ...executionResult.data,
                iteration: currentIteration,
                duration: executionResult.duration
              }
            );

            results.push(actionResult);
            this.emitEvent('action-completed', { action, result: actionResult, iteration: currentIteration });

            // If action failed, log and continue
            if (!executionResult.success) {
              this.log('warn', 'Action execution failed', {
                action,
                error: executionResult.error,
                iteration: currentIteration
              });
            } else {
              this.log('info', 'Action executed successfully', {
                action: action.type,
                duration: executionResult.duration,
                iteration: currentIteration
              });
            }

            // Wait between actions for stability
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log('error', 'Action execution error', { action, error: errorMsg, iteration: currentIteration });

            const errorResult = this.createActionResult(
              action.id,
              false,
              errorMsg,
              { action, iteration: currentIteration }
            );
            results.push(errorResult);
          }
        }

        this.emitEvent('iteration-completed', {
          iteration: currentIteration,
          actionsExecuted: analysis.actions.length,
          results: results.slice(-analysis.actions.length),
          sessionId
        });

        // Check if we should continue based on AI confidence and recent success
        const shouldContinue = this.shouldContinueExecution(results, analysis);
        if (!shouldContinue) {
          this.log('info', 'Stopping execution based on analysis', {
            confidence: analysis.confidence,
            iteration: currentIteration
          });
          break;
        }

        // Wait before next iteration
        if (this.iterationDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.iterationDelay));
        }
      }

      if (currentIteration >= this.maxIterations) {
        this.log('warn', 'Maximum iterations reached', { maxIterations: this.maxIterations });
        this.emitEvent('max-iterations-reached', { maxIterations: this.maxIterations, results, sessionId });

        const maxIterResult = this.createActionResult(
          `max-iterations-${Date.now()}`,
          false,
          `Reached maximum iterations (${this.maxIterations}) without completing the task`,
          {
            action: 'max_iterations_reached',
            maxIterations: this.maxIterations,
            suggestion: 'Task may be too complex or require manual intervention'
          }
        );
        results.push(maxIterResult);
      }

      // Update session with final results
      this.sessionManager.updateSession(sessionId, {
        results,
        status: 'completed',
        endTime: Date.now()
      });

      this.log('info', 'Task execution completed', {
        sessionId,
        iterations: currentIteration,
        totalActions: results.length
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', 'Execution failed', { error: errorMessage, iteration: currentIteration, sessionId });

      // Add error result
      const errorResult = this.createActionResult(
        this.generateId(),
        false,
        errorMessage,
        { error, iteration: currentIteration, sessionId }
      );
      results.push(errorResult);

      // Update session with error
      this.sessionManager.updateSession(sessionId, {
        results,
        status: 'error',
        error: errorMessage,
        endTime: Date.now()
      });

      throw new AgentError(`Execution failed at iteration ${currentIteration}: ${errorMessage}`, {
        error,
        results,
        iteration: currentIteration,
        sessionId
      });
    }
  }

  protected async onPause(): Promise<void> {
    this.log('info', 'Local computer agent paused');
    this.emitEvent('agent-paused', {});
  }

  protected async onResume(): Promise<void> {
    this.log('info', 'Local computer agent resumed');
    this.emitEvent('agent-resumed', {});
  }

  protected async onStop(): Promise<void> {
    try {
      if (this.screenOperator) {
        await this.screenOperator.cleanup();
        this.screenOperator = undefined;
      }

      if (this.inputOperator) {
        await this.inputOperator.cleanup();
        this.inputOperator = undefined;
      }

      if (this.model) {
        await this.model.cleanup();
        this.model = undefined;
      }

      // Clean up services
      this.aiVisionService = undefined;
      this.actionExecutor = undefined;

      // Clear old sessions (keep last 24 hours)
      if (this.sessionManager) {
        this.sessionManager.clearOldSessions(24 * 60 * 60 * 1000);
        this.sessionManager = undefined;
      }

      this.log('info', 'Local computer agent stopped and cleaned up');
    } catch (error) {
      this.log('warn', 'Error during cleanup', { error });
    }
  }

  private async initializeModel(config: AgentConfig): Promise<void> {
    switch (config.model.provider) {
      case ModelProvider.OPENAI:
        this.model = new OpenAIVisionModel();
        break;
      case ModelProvider.ANTHROPIC:
        this.model = new AnthropicClaudeModel();
        break;
      case ModelProvider.CUSTOM:
        this.model = new OpenRouterModel();
        break;
      default:
        throw new AgentError(`Unsupported model provider: ${config.model.provider}`);
    }

    await this.model.initialize(config.model);
    this.log('info', 'AI model initialized', { provider: config.model.provider, name: config.model.name });
  }

  private isScreenAction(actionType: ActionType): boolean {
    return actionType === ActionType.SCREENSHOT;
  }

  private isInputAction(actionType: ActionType): boolean {
    return [
      ActionType.CLICK,
      ActionType.DOUBLE_CLICK,
      ActionType.RIGHT_CLICK,
      ActionType.DRAG,
      ActionType.TYPE,
      ActionType.KEY,
      ActionType.SCROLL,
      ActionType.WAIT
    ].includes(actionType);
  }

  private shouldContinueExecution(results: ActionResult[], analysis: any): boolean {
    // Check if recent actions were successful (excluding screenshots and analysis)
    const actionResults = results.filter(r =>
      r.data?.action &&
      !['screenshot', 'ai_analysis', 'task_complete'].includes(r.data.action)
    );

    if (actionResults.length >= 3) {
      const recentResults = actionResults.slice(-3);
      const successRate = recentResults.filter(r => r.success).length / recentResults.length;

      if (successRate < 0.3) {
        this.log('warn', 'Low success rate, stopping execution', { successRate });
        return false;
      }
    }

    // Check AI confidence
    if (analysis.confidence < 0.2) {
      this.log('warn', 'Very low AI confidence, stopping execution', { confidence: analysis.confidence });
      return false;
    }

    // Check for repeated failures
    const lastFiveActions = actionResults.slice(-5);
    const failureCount = lastFiveActions.filter(r => !r.success).length;
    if (failureCount >= 4) {
      this.log('warn', 'Too many recent failures, stopping execution', { failureCount });
      return false;
    }

    return true;
  }

  // Public methods for external control
  public async takeScreenshot(): Promise<Screenshot> {
    if (!this.screenOperator) {
      throw new AgentError('Screen operator not initialized');
    }
    return this.screenOperator.capture();
  }

  public async executeAction(action: Action): Promise<ActionResult> {
    if (this.isScreenAction(action.type)) {
      if (!this.screenOperator) {
        throw new AgentError('Screen operator not initialized');
      }
      return this.screenOperator.execute(action);
    } else if (this.isInputAction(action.type)) {
      if (!this.inputOperator) {
        throw new AgentError('Input operator not initialized');
      }
      return this.inputOperator.execute(action);
    } else {
      throw new AgentError(`Unsupported action type: ${action.type}`);
    }
  }

  public getModelInfo(): any {
    return this.model ? {
      provider: this.model.provider,
      name: this.model.name,
      version: this.model.version,
      isInitialized: this.model.isInitialized
    } : null;
  }

  public getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  public getCurrentSession(): any {
    return this.sessionManager?.getCurrentSession();
  }

  public getSessionHistory(limit: number = 10): any[] {
    return this.sessionManager?.getSessionHistory(limit) || [];
  }

  public getAgentStats(): {
    isInitialized: boolean;
    hasScreenOperator: boolean;
    hasInputOperator: boolean;
    hasAIVision: boolean;
    maxIterations: number;
    iterationDelay: number;
  } {
    return {
      isInitialized: this._isInitialized,
      hasScreenOperator: !!this.screenOperator,
      hasInputOperator: !!this.inputOperator,
      hasAIVision: !!this.aiVisionService,
      maxIterations: this.maxIterations,
      iterationDelay: this.iterationDelay
    };
  }
}
