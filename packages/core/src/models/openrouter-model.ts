import { BaseModel, AnalysisContext } from './base-model';
import {
  ModelProvider,
  ModelConfig,
  ModelResponse,
  Action,
  ValidationResult,
  ExecutionContext,
  ActionType,
  ModelError
} from '../types';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterModel extends BaseModel {
  private apiKey?: string;
  private baseUrl?: string;
  private modelName?: string;
  private appName?: string;

  constructor() {
    super(ModelProvider.CUSTOM, 'openrouter', '1.0');
  }

  protected async onInitialize(config: ModelConfig): Promise<void> {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.modelName = config.name || 'anthropic/claude-3.5-sonnet';
    this.appName = config.parameters?.appName || 'Robin Assistant';

    if (!this.apiKey) {
      throw new ModelError('OpenRouter API key is required');
    }

    this.log('info', 'OpenRouter model initialized', { 
      model: this.modelName,
      baseUrl: this.baseUrl 
    });
  }

  protected async onAnalyze(
    image: Buffer,
    instruction: string,
    context?: ExecutionContext
  ): Promise<ModelResponse> {
    if (!this.validateImageFormat(image)) {
      throw new ModelError('Invalid image format. Only PNG and JPEG are supported.');
    }

    const instructionValidation = this.validateInstruction(instruction);
    if (!instructionValidation.valid) {
      throw new ModelError(`Invalid instruction: ${instructionValidation.errors.join(', ')}`);
    }

    try {
      const base64Image = image.toString('base64');
      const imageUrl = `data:image/png;base64,${base64Image}`;

      const messages: OpenRouterMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.formatUserPrompt(instruction, context)
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ];

      const response = await this.makeAPICall(messages);
      return this.parseResponse(response);
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  protected async onGenerateActions(context: AnalysisContext): Promise<Action[]> {
    const response = await this.onAnalyze(
      context.screenshot.data,
      context.instruction,
      {
        sessionId: 'temp',
        screenshot: context.screenshot,
        previousActions: context.previousActions || [],
        environment: context.environment || {}
      }
    );

    return response.actions;
  }

  protected async onValidateAction(
    action: Action,
    context?: ExecutionContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!action.type) {
      errors.push('Action type is required');
    }

    if (!action.parameters) {
      errors.push('Action parameters are required');
    }

    // Type-specific validation
    switch (action.type) {
      case ActionType.CLICK:
      case ActionType.DOUBLE_CLICK:
      case ActionType.RIGHT_CLICK:
        if (typeof action.parameters.x !== 'number' || typeof action.parameters.y !== 'number') {
          errors.push('Click actions require valid x and y coordinates');
        }
        break;

      case ActionType.TYPE:
        if (!action.parameters.text || typeof action.parameters.text !== 'string') {
          errors.push('Type action requires valid text parameter');
        }
        break;

      case ActionType.DRAG:
        const { fromX, fromY, toX, toY } = action.parameters;
        if (typeof fromX !== 'number' || typeof fromY !== 'number' ||
            typeof toX !== 'number' || typeof toY !== 'number') {
          errors.push('Drag action requires valid fromX, fromY, toX, toY coordinates');
        }
        break;

      case ActionType.WAIT:
        if (typeof action.parameters.duration !== 'number' || action.parameters.duration < 0) {
          errors.push('Wait action requires valid duration parameter');
        }
        break;
    }

    return this.createValidationResult(errors.length === 0, errors, warnings, suggestions);
  }

  protected async onCleanup(): Promise<void> {
    this.apiKey = undefined;
    this.baseUrl = undefined;
    this.modelName = undefined;
    this.log('info', 'OpenRouter model cleaned up');
  }

  private getSystemPrompt(): string {
    return `You are a GUI automation assistant that analyzes screenshots and generates precise actions to accomplish user tasks.

Your capabilities:
1. Analyze screenshots to understand the current state of applications
2. Generate specific actions to accomplish user goals
3. Provide clear reasoning for each action
4. Handle complex multi-step tasks

Available actions:
- click: Click at specific coordinates {"x": number, "y": number}
- double_click: Double-click at coordinates {"x": number, "y": number}
- right_click: Right-click at coordinates {"x": number, "y": number}
- drag: Drag from one point to another {"fromX": number, "fromY": number, "toX": number, "toY": number}
- type: Type text {"text": "string"}
- key: Press keyboard keys {"key": "string", "modifiers": ["ctrl", "shift", etc]}
- scroll: Scroll {"direction": "up/down/left/right", "clicks": number}
- wait: Wait for duration {"duration": milliseconds}
- navigate: Navigate to URL {"url": "string"} (browser only)
- screenshot: Take a screenshot {}
- finished: Mark task as complete {}
- call_user: Ask user for clarification {"message": "string"}

Response format (JSON only):
{
  "reasoning": "Your detailed analysis and reasoning",
  "actions": [
    {
      "type": "action_type",
      "parameters": {"param": "value"},
      "description": "What this action accomplishes"
    }
  ],
  "confidence": 0.95
}

Guidelines:
- Be extremely precise with coordinates
- Analyze the screenshot carefully before acting
- Consider the current application state
- Break complex tasks into simple steps
- Use wait actions when UI updates are expected
- Ask for clarification if the task is unclear`;
  }

  private formatUserPrompt(instruction: string, context?: ExecutionContext): string {
    let prompt = `Task: ${instruction}\n\n`;
    
    if (context?.previousActions && context.previousActions.length > 0) {
      prompt += `Previous actions in this session:\n`;
      context.previousActions.slice(-5).forEach((action, index) => {
        prompt += `${index + 1}. ${action.type}: ${JSON.stringify(action.parameters)}\n`;
      });
      prompt += '\n';
    }

    if (context?.environment) {
      prompt += `Environment context:\n`;
      Object.entries(context.environment).forEach(([key, value]) => {
        prompt += `- ${key}: ${value}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please analyze the screenshot and provide the next action(s) to accomplish this task. Respond with valid JSON only.`;
    
    return prompt;
  }

  private async makeAPICall(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    // Add optional headers for OpenRouter
    if (this.appName) {
      headers['HTTP-Referer'] = 'https://robin-assistant.com';
      headers['X-Title'] = this.appName;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.modelName,
        messages,
        max_tokens: 1000,
        temperature: 0.1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  private parseResponse(response: OpenRouterResponse): ModelResponse {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      // Try to parse as JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        // If not JSON, try to extract JSON from the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse response as JSON');
        }
      }

      const actions: Action[] = (parsed.actions || []).map((actionData: any) => 
        this.createAction(actionData.type, actionData.parameters, actionData.description)
      );

      return {
        reasoning: parsed.reasoning || '',
        actions,
        confidence: parsed.confidence || 0.5,
        metadata: { 
          rawResponse: content,
          model: response.model,
          usage: response.usage
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Failed to parse model response: ${errorMessage}`, {
        response: response.choices[0]?.message?.content
      });
    }
  }

  // Helper method to get available models
  public async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.map((model: any) => model.id) || [];
    } catch (error) {
      this.log('warn', 'Failed to fetch available models', { error });
      return [];
    }
  }

  // Helper method to check model capabilities
  public async getModelInfo(modelId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/models/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model info: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      this.log('warn', 'Failed to fetch model info', { error, modelId });
      return null;
    }
  }
}
