import { BaseAgent } from './base-agent';
import { ScreenOperator } from '../operators/screen-operator';
import { InputOperator } from '../operators/input-operator';
import { BrowserOperator } from '../operators/browser-operator';
import type { SystemOperator } from '../operators/base-operator';
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

export class HybridAgent extends BaseAgent {
  private screenOperator?: ScreenOperator;
  private inputOperator?: InputOperator;
  private browserOperator?: BrowserOperator;
  private model?: any; // AIModel interface
  private aiVisionService?: AIVisionService;
  private actionExecutor?: ActionExecutor;
  private sessionManager?: SessionManager;
  private maxIterations = 20;
  private iterationDelay = 1500;
  private currentMode: 'desktop' | 'browser' = 'desktop';

  constructor() {
    const capabilities: AgentCapability[] = [
      {
        name: 'Desktop Control',
        description: 'Control desktop applications and system UI',
        supported: true,
        requirements: ['Screen operator', 'Input operator']
      },
      {
        name: 'Web Browser Control',
        description: 'Control web browsers and web applications',
        supported: true,
        requirements: ['Browser operator']
      },
      {
        name: 'Cross-Platform Tasks',
        description: 'Execute tasks that span desktop and web applications',
        supported: true,
        requirements: ['All operators', 'Vision model']
      },
      {
        name: 'Intelligent Mode Switching',
        description: 'Automatically switch between desktop and browser control',
        supported: true,
        requirements: ['Vision model', 'All operators']
      },
      {
        name: 'File and Web Integration',
        description: 'Transfer data between local files and web applications',
        supported: true,
        requirements: ['All operators']
      },
      {
        name: 'Multi-Application Workflows',
        description: 'Coordinate actions across multiple applications',
        supported: true,
        requirements: ['All operators', 'Vision model']
      }
    ];

    super(
      'hybrid-agent',
      'Hybrid Agent',
      'AI agent capable of controlling both desktop applications and web browsers',
      capabilities
    );
  }

  protected async onInitialize(config: AgentConfig): Promise<void> {
    try {
      // Initialize all operators
      this.screenOperator = new ScreenOperator();
      await this.screenOperator.initialize(config.operator.settings);

      this.inputOperator = new InputOperator();
      await this.inputOperator.initialize(config.operator.settings);

      this.browserOperator = new BrowserOperator();
      await this.browserOperator.initialize({
        headless: config.operator.settings.headless !== false,
        width: config.operator.settings.width || 1920,
        height: config.operator.settings.height || 1080,
        userAgent: config.operator.settings.userAgent,
        executablePath: config.operator.settings.executablePath
      });

      // Initialize AI model
      await this.initializeModel(config);

      // Initialize AI Vision Service
      this.aiVisionService = new AIVisionService();
      await this.aiVisionService.initialize({
        provider: config.model.provider,
        apiKey: config.model.apiKey,
        model: config.model.name,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Initialize Action Executor with screen and input operators
      this.actionExecutor = new ActionExecutor(
        this.screenOperator,
        this.inputOperator
      );

      // Initialize Session Manager
      this.sessionManager = new SessionManager();

      // Set agent settings
      this.maxIterations = config.settings.maxIterations || 20;
      this.iterationDelay = config.settings.iterationDelay || 1500;

      this.log('info', 'Hybrid agent initialized successfully with full automation capabilities');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to initialize hybrid agent: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(instruction: string, context: ExecutionContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    let currentIteration = 0;
    let lastScreenshot: Screenshot | undefined;

    try {
      this.log('info', 'Starting hybrid task execution', { instruction, maxIterations: this.maxIterations });

      // Determine initial mode based on instruction
      this.currentMode = this.determineInitialMode(instruction);
      this.emitEvent('mode-determined', { mode: this.currentMode, instruction });

      while (currentIteration < this.maxIterations) {
        currentIteration++;
        this.emitEvent('iteration-started', { 
          iteration: currentIteration, 
          instruction, 
          mode: this.currentMode 
        });

        // Capture current state based on mode
        lastScreenshot = await this.captureCurrentState();
        this.emitEvent('screenshot-captured', { 
          screenshot: lastScreenshot, 
          iteration: currentIteration,
          mode: this.currentMode
        });

        // Analyze current state and get next actions
        const response = await this.model.analyze(
          lastScreenshot.data,
          instruction,
          {
            ...context,
            screenshot: lastScreenshot,
            previousActions: results.map(r => r.data?.action).filter(Boolean),
            environment: {
              ...context.environment,
              currentMode: this.currentMode,
              availableOperators: ['screen', 'input', 'browser']
            }
          }
        );

        this.emitEvent('analysis-completed', { 
          response, 
          iteration: currentIteration,
          reasoning: response.reasoning,
          mode: this.currentMode
        });

        if (!response.actions || response.actions.length === 0) {
          this.log('warn', 'No actions generated by model', { iteration: currentIteration });
          break;
        }

        // Execute each action
        for (const action of response.actions) {
          this.emitEvent('action-started', { action, iteration: currentIteration, mode: this.currentMode });

          // Check if task is finished
          if (action.type === ActionType.FINISHED) {
            this.log('info', 'Task marked as finished by model');
            results.push(this.createActionResult(action.id, true, undefined, { 
              action, 
              finished: true,
              mode: this.currentMode
            }));
            return results;
          }

          // Check if user input is needed
          if (action.type === ActionType.CALL_USER) {
            this.emitEvent('user-input-requested', { 
              message: action.parameters.message,
              action,
              iteration: currentIteration,
              mode: this.currentMode
            });
            results.push(this.createActionResult(action.id, true, undefined, { 
              action,
              userInputRequested: true,
              message: action.parameters.message,
              mode: this.currentMode
            }));
            return results;
          }

          // Check if mode switch is needed
          const newMode = this.determineModeForAction(action);
          if (newMode !== this.currentMode) {
            this.log('info', 'Switching mode', { from: this.currentMode, to: newMode, action: action.type });
            this.currentMode = newMode;
            this.emitEvent('mode-switched', { 
              previousMode: this.currentMode === 'desktop' ? 'browser' : 'desktop',
              newMode: this.currentMode,
              action
            });
          }

          // Validate action before execution
          const validation = await this.model.validateAction(action, {
            ...context,
            screenshot: lastScreenshot
          });

          if (!validation.valid) {
            const errorMsg = `Action validation failed: ${validation.errors.join(', ')}`;
            this.log('error', errorMsg, { action, validation });
            results.push(this.createActionResult(action.id, false, errorMsg, { action }));
            continue;
          }

          // Execute the action using appropriate operator
          const actionResult = await this.executeActionWithOperator(action);
          results.push(actionResult);

          this.emitEvent('action-completed', { 
            action, 
            result: actionResult, 
            iteration: currentIteration,
            mode: this.currentMode
          });

          // If action failed, log and continue
          if (!actionResult.success) {
            this.log('warn', 'Action execution failed', { 
              action, 
              error: actionResult.error,
              iteration: currentIteration,
              mode: this.currentMode
            });
          }

          // Wait between actions if configured
          if (this.iterationDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.iterationDelay));
          }
        }

        this.emitEvent('iteration-completed', { 
          iteration: currentIteration, 
          actionsExecuted: response.actions.length,
          results: results.slice(-response.actions.length),
          mode: this.currentMode
        });

        // Check if we should continue
        const shouldContinue = await this.shouldContinueExecution(results, response);
        if (!shouldContinue) {
          this.log('info', 'Stopping execution based on analysis');
          break;
        }
      }

      if (currentIteration >= this.maxIterations) {
        this.log('warn', 'Maximum iterations reached', { maxIterations: this.maxIterations });
        this.emitEvent('max-iterations-reached', { 
          maxIterations: this.maxIterations, 
          results,
          finalMode: this.currentMode
        });
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', 'Execution failed', { error: errorMessage, iteration: currentIteration });
      
      // Add error result
      results.push(this.createActionResult(
        this.generateId(),
        false,
        errorMessage,
        { error, iteration: currentIteration, mode: this.currentMode }
      ));
      
      throw new AgentError(`Execution failed at iteration ${currentIteration}: ${errorMessage}`, { 
        error, 
        results,
        iteration: currentIteration 
      });
    }
  }

  protected async onPause(): Promise<void> {
    this.log('info', 'Hybrid agent paused');
    this.emitEvent('agent-paused', { mode: this.currentMode });
  }

  protected async onResume(): Promise<void> {
    this.log('info', 'Hybrid agent resumed');
    this.emitEvent('agent-resumed', { mode: this.currentMode });
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

      if (this.browserOperator) {
        await this.browserOperator.cleanup();
        this.browserOperator = undefined;
      }

      if (this.model) {
        await this.model.cleanup();
        this.model = undefined;
      }

      this.log('info', 'Hybrid agent stopped and cleaned up');
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

  private determineInitialMode(instruction: string): 'desktop' | 'browser' {
    const webKeywords = ['website', 'browser', 'url', 'http', 'www', 'search online', 'web page', 'navigate to'];
    const desktopKeywords = ['file', 'folder', 'desktop', 'application', 'window', 'system'];
    
    const lowerInstruction = instruction.toLowerCase();
    
    const webScore = webKeywords.reduce((score, keyword) => 
      score + (lowerInstruction.includes(keyword) ? 1 : 0), 0);
    const desktopScore = desktopKeywords.reduce((score, keyword) => 
      score + (lowerInstruction.includes(keyword) ? 1 : 0), 0);
    
    return webScore > desktopScore ? 'browser' : 'desktop';
  }

  private determineModeForAction(action: Action): 'desktop' | 'browser' {
    if (action.type === ActionType.NAVIGATE) {
      return 'browser';
    }
    
    // Browser-specific actions
    if (action.parameters.selector || action.parameters.url) {
      return 'browser';
    }
    
    // Desktop-specific actions (coordinates-based)
    if (typeof action.parameters.x === 'number' && typeof action.parameters.y === 'number') {
      return 'desktop';
    }
    
    // Default to current mode
    return this.currentMode;
  }

  private async captureCurrentState(): Promise<Screenshot> {
    if (this.currentMode === 'browser' && this.browserOperator) {
      return this.browserOperator.capture();
    } else if (this.screenOperator) {
      return this.screenOperator.capture();
    } else {
      throw new AgentError('No suitable operator available for screenshot capture');
    }
  }

  private async executeActionWithOperator(action: Action): Promise<ActionResult> {
    // Browser actions
    if (this.isBrowserAction(action) && this.browserOperator) {
      return this.browserOperator.execute(action);
    }
    
    // Screen capture actions
    if (action.type === ActionType.SCREENSHOT) {
      if (this.currentMode === 'browser' && this.browserOperator) {
        return this.browserOperator.execute(action);
      } else if (this.screenOperator) {
        return this.screenOperator.execute(action);
      }
    }
    
    // Input actions
    if (this.isInputAction(action) && this.inputOperator) {
      return this.inputOperator.execute(action);
    }
    
    throw new AgentError(`No suitable operator available for action: ${action.type}`);
  }

  private isBrowserAction(action: Action): boolean {
    return action.type === ActionType.NAVIGATE || 
           action.parameters.selector !== undefined ||
           action.parameters.url !== undefined;
  }

  private isInputAction(action: Action): boolean {
    return [
      ActionType.CLICK,
      ActionType.DOUBLE_CLICK,
      ActionType.RIGHT_CLICK,
      ActionType.DRAG,
      ActionType.TYPE,
      ActionType.KEY,
      ActionType.SCROLL,
      ActionType.WAIT
    ].includes(action.type);
  }

  private async shouldContinueExecution(results: ActionResult[], lastResponse: any): Promise<boolean> {
    // Check if recent actions were successful
    const recentResults = results.slice(-4);
    const successRate = recentResults.filter(r => r.success).length / recentResults.length;
    
    if (successRate < 0.4) {
      this.log('warn', 'Low success rate, considering stopping', { successRate });
      return false;
    }

    // Check model confidence
    if (lastResponse.confidence < 0.25) {
      this.log('warn', 'Low model confidence, considering stopping', { confidence: lastResponse.confidence });
      return false;
    }

    return true;
  }

  // Public methods for external control
  public async takeScreenshot(): Promise<Screenshot> {
    return this.captureCurrentState();
  }

  public async switchMode(mode: 'desktop' | 'browser'): Promise<void> {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.emitEvent('mode-switched', { previousMode, newMode: mode, manual: true });
    this.log('info', 'Mode switched manually', { from: previousMode, to: mode });
  }

  public getCurrentMode(): 'desktop' | 'browser' {
    return this.currentMode;
  }

  public async executeAction(action: Action): Promise<ActionResult> {
    return this.executeActionWithOperator(action);
  }

  public getModelInfo(): any {
    return this.model ? {
      provider: this.model.provider,
      name: this.model.name,
      version: this.model.version,
      isInitialized: this.model.isInitialized
    } : null;
  }

  public getOperatorStatus(): { screen: boolean; input: boolean; browser: boolean } {
    return {
      screen: this.screenOperator ? this.screenOperator.isInitialized : false,
      input: this.inputOperator ? this.inputOperator.isInitialized : false,
      browser: this.browserOperator ? this.browserOperator.isInitialized : false
    };
  }
}
