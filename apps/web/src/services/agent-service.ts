import { 
  LocalComputerAgent, 
  WebBrowserAgent, 
  HybridAgent 
} from '@robin/core/agents';
// Models will be imported dynamically as needed
import { 
  AgentConfig as CoreAgentConfig,
  ModelProvider,
  OperatorType,
  ActionResult as CoreActionResult,
  Screenshot as CoreScreenshot,
  AgentStatus as CoreAgentStatus
} from '@robin/core/types';
import { AgentConfig, Screenshot, ActionResult, AgentStatus } from '../stores/agent-store';

import {
  screenCaptureManager,
  initializeScreenCapture,
  captureScreen as unifiedCaptureScreen,
  getScreenCaptureEnvironment,
  isScreenCaptureSupported
} from './unified-screen-capture';

export class AgentService {
  private currentAgent: LocalComputerAgent | WebBrowserAgent | HybridAgent | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  async initializeAgent(config: AgentConfig): Promise<void> {
    try {
      // In browser environment, we don't initialize real agents
      if (typeof window !== 'undefined') {
        const environment = getScreenCaptureEnvironment();
        console.log(`${environment} environment detected - using ${environment === 'electron' ? 'native desktop' : 'simulated'} agent execution`);

        // Try to initialize unified screen capture
        try {
          await initializeScreenCapture();
          const isSupported = await isScreenCaptureSupported();
          console.log(`Screen capture ${isSupported ? 'available' : 'not available'} in ${environment} environment`);
        } catch (error) {
          console.warn('Screen capture not available, using fallback mode:', error);
        }

        console.log(`${environment === 'electron' ? 'Desktop' : 'Browser'} agent initialized:`, config.name);
        return;
      }

      // Node.js environment - initialize real agents
      const coreConfig: CoreAgentConfig = this.convertToCoreConfig(config);

      // Create appropriate agent based on type
      switch (config.operator.type) {
        case 'local_computer':
          this.currentAgent = new LocalComputerAgent();
          break;
        case 'web_browser':
          this.currentAgent = new WebBrowserAgent();
          break;
        case 'hybrid':
          this.currentAgent = new HybridAgent();
          break;
        default:
          throw new Error(`Unsupported agent type: ${config.operator.type}`);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Initialize the agent
      await this.currentAgent.initialize(coreConfig);

      console.log('Agent initialized successfully:', config.name);
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  async executeInstruction(instruction: string): Promise<{
    success: boolean;
    results: ActionResult[];
    screenshots: Screenshot[];
    error?: string;
  }> {
    try {
      // In browser environment, we need to handle this differently
      if (typeof window !== 'undefined') {
        return await this.executeBrowserInstruction(instruction);
      }

      // Node.js environment - use real agents
      if (!this.currentAgent) {
        throw new Error('No agent initialized');
      }

      const context = {
        sessionId: `session-${Date.now()}`,
        previousActions: [],
        environment: {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      // Execute the instruction
      const results = await this.currentAgent.execute(instruction, context);

      // Convert results to web format
      const webResults = results.map(this.convertActionResult);
      const screenshots = this.extractScreenshots(results);

      return {
        success: true,
        results: webResults,
        screenshots
      };
    } catch (error) {
      console.error('Agent execution failed:', error);
      return {
        success: false,
        results: [],
        screenshots: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async takeScreenshot(): Promise<Screenshot | null> {
    try {
      // In browser/Electron environment, use unified screen capture
      if (typeof window !== 'undefined') {
        const environment = getScreenCaptureEnvironment();
        console.log(`Taking screenshot in ${environment} environment`);

        // Use unified screen capture service
        const screenshot = await unifiedCaptureScreen();
        return screenshot;
      }

      // In Node.js environment, use agent's screenshot capability
      if (!this.currentAgent) {
        throw new Error('No agent available for screenshot in Node.js environment');
      }

      const screenshot = await this.currentAgent.takeScreenshot();
      return this.convertScreenshot(screenshot);
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }

  async pauseAgent(): Promise<void> {
    if (typeof window !== 'undefined') {
      console.log('Agent paused (browser simulation)');
      return;
    }

    if (this.currentAgent) {
      await this.currentAgent.pause();
    }
  }

  async resumeAgent(): Promise<void> {
    if (typeof window !== 'undefined') {
      console.log('Agent resumed (browser simulation)');
      return;
    }

    if (this.currentAgent) {
      await this.currentAgent.resume();
    }
  }

  async stopAgent(): Promise<void> {
    if (typeof window !== 'undefined') {
      const environment = getScreenCaptureEnvironment();
      console.log(`Agent stopped (${environment} environment)`);

      // Clean up screen capture
      try {
        await screenCaptureManager.cleanup();
      } catch (error) {
        console.warn('Error cleaning up screen capture:', error);
      }
      return;
    }

    if (this.currentAgent) {
      await this.currentAgent.stop();
      this.currentAgent = null;
    }
  }

  getAgentStatus(): AgentStatus {
    // In browser/Electron environment, return based on screen capture status
    if (typeof window !== 'undefined') {
      try {
        const capabilities = screenCaptureManager.getCapabilities();
        if (capabilities.supported) {
          return AgentStatus.IDLE; // Ready to execute
        } else {
          return AgentStatus.STOPPED; // Screen capture not available
        }
      } catch (error) {
        return AgentStatus.ERROR;
      }
    }

    // Node.js environment
    if (!this.currentAgent) {
      return AgentStatus.IDLE;
    }

    // Convert core status to web status
    const coreStatus = this.currentAgent.getStatus();
    switch (coreStatus) {
      case CoreAgentStatus.IDLE:
        return AgentStatus.IDLE;
      case CoreAgentStatus.INITIALIZING:
        return AgentStatus.INITIALIZING;
      case CoreAgentStatus.RUNNING:
        return AgentStatus.RUNNING;
      case CoreAgentStatus.PAUSED:
        return AgentStatus.PAUSED;
      case CoreAgentStatus.ERROR:
        return AgentStatus.ERROR;
      case CoreAgentStatus.STOPPED:
        return AgentStatus.STOPPED;
      default:
        return AgentStatus.IDLE;
    }
  }

  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private convertToCoreConfig(config: AgentConfig): CoreAgentConfig {
    return {
      id: config.id,
      name: config.name,
      model: {
        provider: this.convertModelProvider(config.model.provider),
        name: config.model.name || config.model.modelName,
        apiKey: config.model.apiKey,
        baseUrl: config.model.baseUrl,
        version: config.model.version || '1.0',
        parameters: {
          temperature: config.model.temperature || 0.1,
          maxTokens: config.model.maxTokens || 4000,
          ...config.model.parameters
        }
      },
      operator: {
        type: this.convertOperatorType(config.operator.type),
        settings: {
          headless: config.operator.headless !== false,
          width: config.operator.width || 1920,
          height: config.operator.height || 1080,
          userAgent: config.operator.userAgent,
          executablePath: config.operator.executablePath,
          ...config.operator.settings
        }
      },
      settings: {
        maxIterations: config.settings.maxIterations || 10,
        iterationDelay: config.settings.iterationDelay || 1000,
        autoScreenshot: config.settings.autoScreenshot !== false,
        confirmActions: config.settings.confirmActions === true,
        language: config.settings.language || 'en',
        ...config.settings
      }
    };
  }

  private convertModelProvider(provider: string): ModelProvider {
    switch (provider.toLowerCase()) {
      case 'openai':
        return ModelProvider.OPENAI;
      case 'anthropic':
        return ModelProvider.ANTHROPIC;
      case 'openrouter':
      case 'custom':
        return ModelProvider.CUSTOM;
      case 'local':
        return ModelProvider.LOCAL;
      default:
        return ModelProvider.CUSTOM;
    }
  }

  private convertOperatorType(type: string): OperatorType {
    switch (type) {
      case 'local_computer':
        return OperatorType.LOCAL_COMPUTER;
      case 'web_browser':
        return OperatorType.WEB_BROWSER;
      case 'hybrid':
        return OperatorType.HYBRID;
      default:
        return OperatorType.LOCAL_COMPUTER;
    }
  }

  private convertActionResult(result: CoreActionResult): ActionResult {
    return {
      id: result.actionId || `action-${Date.now()}`,
      success: result.success,
      error: result.error,
      data: result.data
    };
  }

  private convertScreenshot(screenshot: CoreScreenshot): Screenshot {
    return {
      data: `data:image/png;base64,${screenshot.data.toString('base64')}`,
      width: screenshot.width,
      height: screenshot.height,
      timestamp: screenshot.timestamp
    };
  }



  private async executeBrowserInstruction(instruction: string): Promise<{
    success: boolean;
    results: ActionResult[];
    screenshots: Screenshot[];
    error?: string;
  }> {
    try {
      const environment = getScreenCaptureEnvironment();
      console.log(`Executing instruction in ${environment} environment:`, instruction);

      // Take initial screenshot using unified screen capture
      const screenshot = await unifiedCaptureScreen();

      // Get AI model configuration
      const aiConfig = this.getAIConfig();

      const results: ActionResult[] = [];

      // Add screenshot result
      results.push({
        id: `action-${Date.now()}`,
        success: true,
        data: {
          action: 'screenshot',
          reasoning: 'Captured current screen state for analysis',
          instruction: instruction
        }
      });

      // Call real AI model for analysis
      if (aiConfig) {
        try {
          const aiResponse = await this.callAIModel(instruction, screenshot, aiConfig);

          // Analyze what can be automated in browser
          const automationPlan = this.analyzeBrowserAutomation(instruction);

          // Add AI analysis result
          results.push({
            id: `action-${Date.now() + 1}`,
            success: true,
            data: {
              action: 'ai_analysis',
              reasoning: aiResponse.analysis,
              plannedActions: aiResponse.actions,
              canAutomate: automationPlan.canAutomate,
              limitation: automationPlan.limitation
            }
          });

          // Execute browser-compatible actions if possible
          if (automationPlan.canAutomate && aiResponse.actions.some(a => ['scroll', 'type', 'click'].includes(a.type))) {
            const automationResults = await this.executeBrowserActions(aiResponse.actions);
            results.push(...automationResults);
          }

        } catch (error) {
          console.error('AI model call failed:', error);
          results.push({
            id: `action-${Date.now() + 1}`,
            success: false,
            data: {
              action: 'ai_analysis',
              error: 'AI model unavailable. Please check your configuration in Settings.',
              fallback: 'Using basic instruction analysis instead.'
            }
          });

          // Fallback to basic analysis
          const automationPlan = this.analyzeBrowserAutomation(instruction);
          results.push({
            id: `action-${Date.now() + 2}`,
            success: true,
            data: {
              action: 'basic_analysis',
              reasoning: automationPlan.reasoning,
              limitation: automationPlan.limitation
            }
          });
        }
      } else {
        // No AI configured - show configuration needed
        results.push({
          id: `action-${Date.now() + 1}`,
          success: false,
          data: {
            action: 'configuration_required',
            error: 'No AI model configured',
            instruction: 'Please configure an AI model in Settings to enable intelligent analysis.',
            fallback: 'Using basic instruction parsing instead.'
          }
        });

        // Fallback to basic analysis
        const automationPlan = this.analyzeBrowserAutomation(instruction);
        results.push({
          id: `action-${Date.now() + 2}`,
          success: true,
          data: {
            action: 'basic_analysis',
            reasoning: automationPlan.reasoning,
            limitation: automationPlan.limitation
          }
        });
      }

      return {
        success: true,
        results: results,
        screenshots: [screenshot],
      };
    } catch (error) {
      console.error('Browser instruction execution failed:', error);
      return {
        success: false,
        results: [],
        screenshots: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private extractScreenshots(results: CoreActionResult[]): Screenshot[] {
    return results
      .filter(result => result.screenshot)
      .map(result => this.convertScreenshot(result.screenshot!));
  }

  private setupEventListeners(): void {
    if (!this.currentAgent) return;

    // Listen to agent events and forward them
    this.currentAgent.on('iteration-started', (data) => {
      this.emitEvent('iteration-started', data);
    });

    this.currentAgent.on('screenshot-captured', (data) => {
      this.emitEvent('screenshot-captured', {
        ...data,
        screenshot: this.convertScreenshot(data.screenshot)
      });
    });

    this.currentAgent.on('analysis-completed', (data) => {
      this.emitEvent('analysis-completed', data);
    });

    this.currentAgent.on('action-started', (data) => {
      this.emitEvent('action-started', data);
    });

    this.currentAgent.on('action-completed', (data) => {
      this.emitEvent('action-completed', {
        ...data,
        result: this.convertActionResult(data.result)
      });
    });

    this.currentAgent.on('user-input-requested', (data) => {
      this.emitEvent('user-input-requested', data);
    });

    this.currentAgent.on('agent-paused', (data) => {
      this.emitEvent('agent-paused', data);
    });

    this.currentAgent.on('agent-resumed', (data) => {
      this.emitEvent('agent-resumed', data);
    });
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  private analyzeBrowserAutomation(instruction: string): {
    canAutomate: boolean;
    actions: Array<{ type: string; description: string; target?: string; value?: string }>;
    reasoning: string;
    limitation?: string;
  } {
    const lowerInstruction = instruction.toLowerCase();

    // Check for browser-compatible actions
    if (lowerInstruction.includes('scroll')) {
      return {
        canAutomate: true,
        actions: [
          { type: 'scroll', description: 'Scroll the current page', target: 'page' }
        ],
        reasoning: 'I can scroll the current browser page.'
      };
    }

    if (lowerInstruction.includes('click') && (lowerInstruction.includes('link') || lowerInstruction.includes('button') || lowerInstruction.includes('page'))) {
      return {
        canAutomate: true,
        actions: [
          { type: 'click', description: 'Click on page element', target: 'page-element' }
        ],
        reasoning: 'I can click on elements within the current browser page.'
      };
    }

    if (lowerInstruction.includes('type') && lowerInstruction.includes('text')) {
      return {
        canAutomate: true,
        actions: [
          { type: 'type', description: 'Type text in focused input', target: 'input', value: 'text' }
        ],
        reasoning: 'I can type text in input fields on the current page.'
      };
    }

    if (lowerInstruction.includes('navigate') || lowerInstruction.includes('go to') || lowerInstruction.includes('open') && lowerInstruction.includes('http')) {
      return {
        canAutomate: true,
        actions: [
          { type: 'navigate', description: 'Navigate to URL', target: 'browser' }
        ],
        reasoning: 'I can navigate to web pages within the browser.'
      };
    }

    // Desktop/system actions that can't be automated in browser
    if (lowerInstruction.includes('desktop') || lowerInstruction.includes('icon') || lowerInstruction.includes('application') || lowerInstruction.includes('app')) {
      return {
        canAutomate: false,
        actions: [
          { type: 'desktop-click', description: 'Click desktop application icon' },
          { type: 'launch-app', description: 'Launch desktop application' }
        ],
        reasoning: 'This requires desktop automation which browsers cannot perform due to security restrictions.',
        limitation: 'Browser security prevents interaction with desktop applications and system UI.'
      };
    }

    // Default case - screenshot and analysis only
    return {
      canAutomate: false,
      actions: [
        { type: 'analyze', description: 'Analyze screen content' },
        { type: 'plan', description: 'Plan automation steps' }
      ],
      reasoning: `I understand you want me to: "${instruction}". This would require system-level automation.`,
      limitation: 'Browser environment limits automation to web page interactions only.'
    };
  }

  private async executeBrowserActions(actions: Array<{ type: string; description: string; target?: string; value?: string }>): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      try {
        let success = false;
        let message = '';

        switch (action.type) {
          case 'scroll':
            window.scrollBy(0, 300); // Scroll down 300px
            success = true;
            message = 'Scrolled page down';
            break;

          case 'click':
            // For demo, we'll simulate a click by showing where we would click
            success = true;
            message = 'Would click on page element (demo mode)';
            break;

          case 'type':
            // Focus on active element and simulate typing
            const activeElement = document.activeElement as HTMLInputElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
              activeElement.value += action.value || 'demo text';
              success = true;
              message = `Typed "${action.value || 'demo text'}" in input field`;
            } else {
              success = false;
              message = 'No input field is currently focused';
            }
            break;

          case 'navigate':
            // For security, we can't navigate without user permission
            success = true;
            message = 'Would navigate to URL (requires user permission)';
            break;

          default:
            success = false;
            message = `Action type "${action.type}" not supported in browser`;
        }

        results.push({
          id: `action-${Date.now()}-${Math.random()}`,
          success: success,
          data: {
            action: action.type,
            description: action.description,
            message: message,
            target: action.target
          }
        });

        // Small delay between actions
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        results.push({
          id: `action-${Date.now()}-${Math.random()}`,
          success: false,
          data: {
            action: action.type,
            description: action.description,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    return results;
  }

  private getAIConfig(): { provider: string; apiKey: string; model: string } | null {
    // Get AI configuration from localStorage or settings
    try {
      const savedConfig = localStorage.getItem('robin-ai-config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.apiKey && config.model) {
          return config;
        }
      }
    } catch (error) {
      console.warn('Failed to load AI config:', error);
    }
    return null;
  }

  private async callAIModel(
    instruction: string,
    screenshot: Screenshot,
    config: { provider: string; apiKey: string; model: string }
  ): Promise<{
    analysis: string;
    actions: Array<{ type: string; description: string; target?: string; value?: string }>;
  }> {
    const prompt = `You are Robin Assistant, an AI automation agent. Analyze this screenshot and the user's instruction.

User Instruction: "${instruction}"

Screenshot: The user's current screen (${screenshot.width}x${screenshot.height})

Please provide:
1. Analysis of what you can see in the screenshot
2. Whether the instruction can be completed in a browser environment
3. Specific actions that could be taken

Browser Environment Limitations:
- Can only interact with the current webpage
- Cannot click desktop applications or system UI
- Cannot access files outside the browser
- Can scroll, click web elements, type in forms

Respond in JSON format:
{
  "analysis": "Detailed analysis of the screenshot and instruction",
  "actions": [
    {"type": "action_type", "description": "what this action does", "target": "optional_target"}
  ]
}`;

    try {
      let response;

      switch (config.provider.toLowerCase()) {
        case 'openai':
          response = await this.callOpenAI(prompt, screenshot, config);
          break;
        case 'anthropic':
          response = await this.callAnthropic(prompt, screenshot, config);
          break;
        case 'openrouter':
          response = await this.callOpenRouter(prompt, screenshot, config);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${config.provider}`);
      }

      // Parse JSON response
      try {
        const parsed = JSON.parse(response);
        return {
          analysis: parsed.analysis || 'AI analysis completed',
          actions: parsed.actions || []
        };
      } catch (parseError) {
        // If JSON parsing fails, use the raw response as analysis
        return {
          analysis: response,
          actions: []
        };
      }

    } catch (error) {
      console.error('AI model call failed:', error);
      throw error;
    }
  }

  private async callOpenAI(prompt: string, screenshot: Screenshot, config: { apiKey: string; model: string }): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: screenshot.data.startsWith('data:') ? screenshot.data : `data:image/png;base64,${screenshot.data}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenAI';
  }

  private async callAnthropic(prompt: string, screenshot: Screenshot, config: { apiKey: string; model: string }): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: screenshot.data.replace(/^data:image\/[^;]+;base64,/, '')
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response from Anthropic';
  }

  private async callOpenRouter(prompt: string, screenshot: Screenshot, config: { apiKey: string; model: string }): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Robin Assistant'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: screenshot.data.startsWith('data:') ? screenshot.data : `data:image/png;base64,${screenshot.data}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenRouter';
  }
}

// Singleton instance
export const agentService = new AgentService();
