import { BaseAgent } from './base-agent';
import { BrowserOperator } from '../operators/browser-operator';
import { OpenAIVisionModel } from '../models/openai-vision-model';
import { AnthropicClaudeModel } from '../models/anthropic-claude-model';
import { OpenRouterModel } from '../models/openrouter-model';
import { AIVisionService } from '../services/ai-vision-service';
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

export class WebBrowserAgent extends BaseAgent {
  private browserOperator?: BrowserOperator;
  private model?: any; // AIModel interface
  private aiVisionService?: AIVisionService;
  private sessionManager?: SessionManager;
  private maxIterations = 15;
  private iterationDelay = 2000;
  private currentUrl?: string;

  constructor() {
    const capabilities: AgentCapability[] = [
      {
        name: 'Web Navigation',
        description: 'Navigate to web pages and URLs',
        supported: true,
        requirements: ['Browser operator']
      },
      {
        name: 'Web Element Interaction',
        description: 'Click, type, and interact with web elements',
        supported: true,
        requirements: ['Browser operator', 'Vision model']
      },
      {
        name: 'Form Automation',
        description: 'Fill out and submit web forms',
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
        name: 'Multi-step Web Tasks',
        description: 'Execute complex web automation workflows',
        supported: true,
        requirements: ['All operators', 'Vision model']
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

      // Initialize AI Vision Service
      this.aiVisionService = new AIVisionService();
      await this.aiVisionService.initialize({
        provider: config.model.provider,
        apiKey: config.model.apiKey,
        model: config.model.name,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Initialize session manager
      this.sessionManager = new SessionManager();

      // Set agent settings
      this.maxIterations = config.settings.maxIterations || 15;
      this.iterationDelay = config.settings.iterationDelay || 2000;

      this.log('info', 'Web browser agent initialized successfully with real automation capabilities');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AgentError(`Failed to initialize web browser agent: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(instruction: string, context: ExecutionContext): Promise<ActionResult[]> {
    if (!this.aiVisionService || !this.sessionManager || !this.browserOperator) {
      throw new AgentError('Services not initialized');
    }

    const sessionId = this.sessionManager.createSession(instruction);
    const results: ActionResult[] = [];
    let currentIteration = 0;

    try {
      this.log('info', 'Starting real web automation execution', { instruction, maxIterations: this.maxIterations, sessionId });

      // If instruction includes a URL, navigate there first
      const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !this.currentUrl) {
        const navigateAction = this.createAction(ActionType.NAVIGATE, { url: urlMatch[0] }, 'Navigate to URL from instruction');
        const navResult = await this.browserOperator.execute(navigateAction);
        results.push(navResult);
        
        if (navResult.success) {
          this.currentUrl = urlMatch[0];
          this.emitEvent('navigation-completed', { url: this.currentUrl });
        }
      }

      while (currentIteration < this.maxIterations) {
        currentIteration++;
        this.emitEvent('iteration-started', { iteration: currentIteration, instruction, sessionId });

        // Capture current page state
        const lastScreenshot = await this.browserOperator.capture();
        this.currentUrl = await this.browserOperator.getCurrentUrl();
        
        this.emitEvent('screenshot-captured', { 
          screenshot: lastScreenshot, 
          iteration: currentIteration,
          url: this.currentUrl 
        });

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
            },
            url: this.currentUrl
          }
        );
        results.push(screenshotResult);

        // Use AI Vision Service for web page analysis
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
          confidence: analysis.confidence,
          url: this.currentUrl
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
            url: this.currentUrl,
            nextActions: analysis.actions.map(a => ({ type: a.type, reasoning: a.reasoning }))
          }
        );
        results.push(analysisResult);

        // Check if task is complete
        if (analysis.isComplete) {
          this.log('info', 'Web task completed successfully', { iteration: currentIteration });
          const completionResult = this.createActionResult(
            `completion-${currentIteration}`,
            true,
            undefined,
            {
              action: 'task_complete',
              iteration: currentIteration,
              message: 'Web task completed successfully',
              finalReasoning: analysis.reasoning,
              url: this.currentUrl
            }
          );
          results.push(completionResult);
          break;
        }

        if (!analysis.actions || analysis.actions.length === 0) {
          this.log('warn', 'No actions generated by AI', { iteration: currentIteration });
          break;
        }

        // Execute each action using browser operator
        for (const action of analysis.actions) {
          this.emitEvent('action-started', { action, iteration: currentIteration });

          try {
            // Execute the action using browser operator
            const actionResult = await this.browserOperator.execute(action);
            
            // Update current URL if navigation occurred
            if (action.type === ActionType.NAVIGATE && actionResult.success) {
              this.currentUrl = await this.browserOperator.getCurrentUrl();
            }

            results.push({
              ...actionResult,
              data: {
                ...actionResult.data,
                iteration: currentIteration,
                url: this.currentUrl
              }
            });

            this.emitEvent('action-completed', { action, result: actionResult, iteration: currentIteration });

            // If action failed, log and continue
            if (!actionResult.success) {
              this.log('warn', 'Web action execution failed', { 
                action, 
                error: actionResult.error,
                iteration: currentIteration,
                url: this.currentUrl
              });
            } else {
              this.log('info', 'Web action executed successfully', {
                action: action.type,
                iteration: currentIteration,
                url: this.currentUrl
              });
            }

            // Wait between actions for page stability
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log('error', 'Web action execution error', { action, error: errorMsg, iteration: currentIteration });
            
            const errorResult = this.createActionResult(
              action.id,
              false,
              errorMsg,
              { action, iteration: currentIteration, url: this.currentUrl }
            );
            results.push(errorResult);
          }
        }

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

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', 'Web execution failed', { error: errorMessage, iteration: currentIteration, sessionId });
      
      throw new AgentError(`Web execution failed at iteration ${currentIteration}: ${errorMessage}`, { 
        error, 
        results,
        iteration: currentIteration,
        sessionId,
        url: this.currentUrl
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

      // Clean up services
      this.aiVisionService = undefined;

      // Clear old sessions (keep last 24 hours)
      if (this.sessionManager) {
        this.sessionManager.clearOldSessions(24 * 60 * 60 * 1000);
        this.sessionManager = undefined;
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

  public getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  public getCurrentSession(): any {
    return this.sessionManager?.getCurrentSession();
  }

  public getSessionHistory(limit: number = 10): any[] {
    return this.sessionManager?.getSessionHistory(limit) || [];
  }
}
