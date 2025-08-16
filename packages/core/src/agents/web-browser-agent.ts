import { BaseAgent } from './base-agent';
import { BrowserOperator } from '../operators/browser-operator';
import { OpenAIVisionModel } from '../models/openai-vision-model';
import { AnthropicClaudeModel } from '../models/anthropic-claude-model';
import { OpenRouterModel } from '../models/openrouter-model';
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

export class WebBrowserAgent extends BaseAgent {
  private browserOperator?: BrowserOperator;
  private model?: any; // AIModel interface
  private maxIterations = 15;
  private iterationDelay = 2000;
  private currentUrl?: string;

  constructor() {
    const capabilities: AgentCapability[] = [
      {
        name: 'Web Navigation',
        description: 'Navigate to websites and web applications',
        supported: true,
        requirements: ['Browser operator']
      },
      {
        name: 'Web Element Interaction',
        description: 'Click buttons, fill forms, and interact with web elements',
        supported: true,
        requirements: ['Browser operator', 'Vision model']
      },
      {
        name: 'Page Analysis',
        description: 'Analyze web page content and structure',
        supported: true,
        requirements: ['Vision model', 'Browser operator']
      },
      {
        name: 'Form Automation',
        description: 'Automatically fill and submit web forms',
        supported: true,
        requirements: ['Browser operator', 'Vision model']
      },
      {
        name: 'Search and Browse',
        description: 'Search for information and browse websites',
        supported: true,
        requirements: ['Browser operator', 'Vision model']
      },
      {
        name: 'Multi-page Tasks',
        description: 'Execute tasks across multiple web pages',
        supported: true,
        requirements: ['Browser operator', 'Vision model']
      }
    ];

    super(
      'web-browser-agent',
      'Web Browser Agent',
      'AI agent for automating web browser interactions and tasks',
      capabilities
    );
  }

  protected async onInitialize(config: AgentConfig): Promise<void> {
    try {
      // Initialize browser operator
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

      // Set agent settings
      this.maxIterations = config.settings.maxIterations || 15;
      this.iterationDelay = config.settings.iterationDelay || 2000;

      this.log('info', 'Web browser agent initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to initialize web browser agent: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(instruction: string, context: ExecutionContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    let currentIteration = 0;
    let lastScreenshot: Screenshot | undefined;

    try {
      this.log('info', 'Starting web task execution', { instruction, maxIterations: this.maxIterations });

      // If instruction includes a URL, navigate there first
      const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !this.currentUrl) {
        const navigateAction = this.createAction(ActionType.NAVIGATE, { url: urlMatch[0] }, 'Navigate to URL from instruction');
        const navResult = await this.browserOperator!.execute(navigateAction);
        results.push(navResult);
        
        if (navResult.success) {
          this.currentUrl = urlMatch[0];
          this.emitEvent('navigation-completed', { url: this.currentUrl });
        }
      }

      while (currentIteration < this.maxIterations) {
        currentIteration++;
        this.emitEvent('iteration-started', { iteration: currentIteration, instruction });

        // Capture current page state
        if (!this.browserOperator) {
          throw new AgentError('Browser operator not initialized');
        }

        lastScreenshot = await this.browserOperator.capture();
        this.currentUrl = await this.browserOperator.getCurrentUrl();
        
        this.emitEvent('screenshot-captured', { 
          screenshot: lastScreenshot, 
          iteration: currentIteration,
          url: this.currentUrl 
        });

        // Analyze page and get next actions
        const response = await this.model.analyze(
          lastScreenshot.data,
          instruction,
          {
            ...context,
            screenshot: lastScreenshot,
            previousActions: results.map(r => r.data?.action).filter(Boolean),
            environment: {
              ...context.environment,
              currentUrl: this.currentUrl,
              pageTitle: await this.getPageTitle()
            }
          }
        );

        this.emitEvent('analysis-completed', { 
          response, 
          iteration: currentIteration,
          reasoning: response.reasoning,
          url: this.currentUrl
        });

        if (!response.actions || response.actions.length === 0) {
          this.log('warn', 'No actions generated by model', { iteration: currentIteration });
          break;
        }

        // Execute each action
        for (const action of response.actions) {
          this.emitEvent('action-started', { action, iteration: currentIteration });

          // Check if task is finished
          if (action.type === ActionType.FINISHED) {
            this.log('info', 'Task marked as finished by model');
            results.push(this.createActionResult(action.id, true, undefined, { 
              action, 
              finished: true,
              finalUrl: this.currentUrl
            }));
            return results;
          }

          // Check if user input is needed
          if (action.type === ActionType.CALL_USER) {
            this.emitEvent('user-input-requested', { 
              message: action.parameters.message,
              action,
              iteration: currentIteration,
              url: this.currentUrl
            });
            results.push(this.createActionResult(action.id, true, undefined, { 
              action,
              userInputRequested: true,
              message: action.parameters.message,
              url: this.currentUrl
            }));
            return results;
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

          // Execute the action
          const actionResult = await this.browserOperator.execute(action);
          results.push(actionResult);

          this.emitEvent('action-completed', { 
            action, 
            result: actionResult, 
            iteration: currentIteration,
            url: this.currentUrl
          });

          // If action failed, log and continue
          if (!actionResult.success) {
            this.log('warn', 'Action execution failed', { 
              action, 
              error: actionResult.error,
              iteration: currentIteration,
              url: this.currentUrl
            });
          }

          // Update current URL after navigation actions
          if (action.type === ActionType.NAVIGATE && actionResult.success) {
            this.currentUrl = await this.browserOperator.getCurrentUrl();
            this.emitEvent('navigation-completed', { url: this.currentUrl });
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
          url: this.currentUrl
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
          finalUrl: this.currentUrl
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
        { error, iteration: currentIteration, url: this.currentUrl }
      ));
      
      throw new AgentError(`Execution failed at iteration ${currentIteration}: ${errorMessage}`, { 
        error, 
        results,
        iteration: currentIteration 
      });
    }
  }

  protected async onPause(): Promise<void> {
    this.log('info', 'Web browser agent paused');
    this.emitEvent('agent-paused', { url: this.currentUrl });
  }

  protected async onResume(): Promise<void> {
    this.log('info', 'Web browser agent resumed');
    this.emitEvent('agent-resumed', { url: this.currentUrl });
  }

  protected async onStop(): Promise<void> {
    try {
      if (this.browserOperator) {
        await this.browserOperator.cleanup();
        this.browserOperator = undefined;
      }

      if (this.model) {
        await this.model.cleanup();
        this.model = undefined;
      }

      this.currentUrl = undefined;
      this.log('info', 'Web browser agent stopped and cleaned up');
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

  private async shouldContinueExecution(results: ActionResult[], lastResponse: any): Promise<boolean> {
    // Check if recent actions were successful
    const recentResults = results.slice(-3);
    const successRate = recentResults.filter(r => r.success).length / recentResults.length;
    
    if (successRate < 0.4) {
      this.log('warn', 'Low success rate, considering stopping', { successRate });
      return false;
    }

    // Check model confidence
    if (lastResponse.confidence < 0.2) {
      this.log('warn', 'Low model confidence, considering stopping', { confidence: lastResponse.confidence });
      return false;
    }

    return true;
  }

  private async getPageTitle(): Promise<string> {
    try {
      return this.browserOperator ? await this.browserOperator.getPageTitle() : '';
    } catch (error) {
      return '';
    }
  }

  // Public methods for external control
  public async takeScreenshot(): Promise<Screenshot> {
    if (!this.browserOperator) {
      throw new AgentError('Browser operator not initialized');
    }
    return this.browserOperator.capture();
  }

  public async navigateToUrl(url: string): Promise<ActionResult> {
    if (!this.browserOperator) {
      throw new AgentError('Browser operator not initialized');
    }
    
    const action = this.createAction(ActionType.NAVIGATE, { url }, `Navigate to ${url}`);
    const result = await this.browserOperator.execute(action);
    
    if (result.success) {
      this.currentUrl = url;
      this.emitEvent('navigation-completed', { url });
    }
    
    return result;
  }

  public async executeAction(action: Action): Promise<ActionResult> {
    if (!this.browserOperator) {
      throw new AgentError('Browser operator not initialized');
    }
    return this.browserOperator.execute(action);
  }

  public getCurrentUrl(): string | undefined {
    return this.currentUrl;
  }

  public async getPageInfo(): Promise<{ url: string; title: string }> {
    if (!this.browserOperator) {
      throw new AgentError('Browser operator not initialized');
    }
    
    return {
      url: await this.browserOperator.getCurrentUrl(),
      title: await this.browserOperator.getPageTitle()
    };
  }

  public getModelInfo(): any {
    return this.model ? {
      provider: this.model.provider,
      name: this.model.name,
      version: this.model.version,
      isInitialized: this.model.isInitialized
    } : null;
  }
}
