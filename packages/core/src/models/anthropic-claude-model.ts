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

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: 'image/png' | 'image/jpeg';
      data: string;
    };
  }>;
}

interface AnthropicResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export class AnthropicClaudeModel extends BaseModel {
  private apiKey?: string;
  private baseUrl?: string;
  private modelName?: string;

  constructor() {
    super(ModelProvider.ANTHROPIC, 'claude-3-5-sonnet-20241022', '1.0');
  }

  protected async onInitialize(config: ModelConfig): Promise<void> {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.modelName = config.name || 'claude-3-5-sonnet-20241022';

    if (!this.apiKey) {
      throw new ModelError('Anthropic API key is required');
    }

    this.log('info', 'Anthropic Claude model initialized', { 
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
      const mediaType = this.detectImageType(image);

      const messages: AnthropicMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.formatUserPrompt(instruction, context)
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
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
        if (action.parameters.x < 0 || action.parameters.y < 0) {
          errors.push('Coordinates must be positive numbers');
        }
        break;

      case ActionType.TYPE:
        if (!action.parameters.text || typeof action.parameters.text !== 'string') {
          errors.push('Type action requires valid text parameter');
        }
        if (action.parameters.text.length > 1000) {
          warnings.push('Text is very long and may cause issues');
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
        if (action.parameters.duration > 30000) {
          warnings.push('Wait duration is very long (>30s)');
        }
        break;

      case ActionType.KEY:
        if (!action.parameters.key || typeof action.parameters.key !== 'string') {
          errors.push('Key action requires valid key parameter');
        }
        break;

      case ActionType.SCROLL:
        if (action.parameters.direction && 
            !['up', 'down', 'left', 'right'].includes(action.parameters.direction)) {
          errors.push('Scroll direction must be up, down, left, or right');
        }
        break;
    }

    return this.createValidationResult(errors.length === 0, errors, warnings, suggestions);
  }

  protected async onCleanup(): Promise<void> {
    this.apiKey = undefined;
    this.baseUrl = undefined;
    this.modelName = undefined;
    this.log('info', 'Anthropic Claude model cleaned up');
  }

  private formatUserPrompt(instruction: string, context?: ExecutionContext): string {
    let prompt = `You are a GUI automation assistant. Analyze the provided screenshot and generate precise actions to accomplish the user's task.

Task: ${instruction}

`;

    if (context?.previousActions && context.previousActions.length > 0) {
      prompt += `Previous actions taken:\n`;
      context.previousActions.forEach((action, index) => {
        prompt += `${index + 1}. ${action.type}: ${JSON.stringify(action.parameters)}\n`;
      });
      prompt += '\n';
    }

    prompt += `Available actions:
- click: Click at coordinates {"x": number, "y": number}
- double_click: Double-click at coordinates {"x": number, "y": number}
- right_click: Right-click at coordinates {"x": number, "y": number}
- drag: Drag from one point to another {"fromX": number, "fromY": number, "toX": number, "toY": number}
- type: Type text {"text": "string"}
- key: Press keyboard keys {"key": "string", "modifiers": ["ctrl", "shift", etc]}
- scroll: Scroll {"direction": "up/down/left/right", "clicks": number}
- wait: Wait for duration {"duration": milliseconds}
- navigate: Navigate to URL {"url": "string"} (browser only)
- finished: Mark task complete {}
- call_user: Ask for clarification {"message": "string"}

Respond with a JSON object:
{
  "reasoning": "Step-by-step analysis of what you see and what needs to be done",
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
- Analyze the screenshot carefully to identify UI elements
- Be precise with coordinates - click exactly on buttons, links, input fields
- Consider the current state and what the user wants to achieve
- Break complex tasks into simple, sequential steps
- Use descriptive reasoning to explain your analysis
- If you can't see the target element clearly, use call_user to ask for clarification`;

    return prompt;
  }

  private async makeAPICall(messages: AnthropicMessage[]): Promise<AnthropicResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: 1000,
        temperature: 0.1,
        system: this.getSystemPrompt(),
        messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  private getSystemPrompt(): string {
    return `You are an expert GUI automation assistant with computer vision capabilities. Your task is to analyze screenshots and generate precise actions to help users accomplish their goals through GUI automation.

Key principles:
1. Accuracy: Be extremely precise with coordinates and element identification
2. Clarity: Provide clear reasoning for each action
3. Safety: Validate actions before suggesting them
4. Efficiency: Choose the most direct path to accomplish the task
5. User-focused: Always consider what the user is trying to achieve

When analyzing screenshots:
- Look for visual cues like buttons, input fields, menus, and interactive elements
- Consider the current state of the application
- Identify the most appropriate elements to interact with
- Be aware of common UI patterns and conventions

Always respond with valid JSON containing reasoning, actions, and confidence level.`;
  }

  private parseResponse(response: AnthropicResponse): ModelResponse {
    try {
      const content = response.content[0]?.text;
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
        metadata: { rawResponse: content }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Failed to parse model response: ${errorMessage}`, {
        response: response.content[0]?.text
      });
    }
  }

  private detectImageType(image: Buffer): 'image/png' | 'image/jpeg' {
    // Check PNG signature
    if (image.length >= 8) {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      if (image.subarray(0, 8).equals(pngSignature)) {
        return 'image/png';
      }
    }

    // Check JPEG signature
    if (image.length >= 2) {
      if (image[0] === 0xFF && image[1] === 0xD8) {
        return 'image/jpeg';
      }
    }

    // Default to PNG
    return 'image/png';
  }
}
