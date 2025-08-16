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

interface OpenAIMessage {
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

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAIVisionModel extends BaseModel {
  private apiKey?: string;
  private baseUrl?: string;
  private modelName?: string;

  constructor() {
    super(ModelProvider.OPENAI, 'gpt-4-vision-preview', '1.0');
  }

  protected async onInitialize(config: ModelConfig): Promise<void> {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.modelName = config.name || 'gpt-4-vision-preview';

    if (!this.apiKey) {
      throw new ModelError('OpenAI API key is required');
    }

    this.log('info', 'OpenAI Vision model initialized', { 
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

      const messages: OpenAIMessage[] = [
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

      case ActionType.NAVIGATE:
        if (!action.parameters.url || typeof action.parameters.url !== 'string') {
          errors.push('Navigate action requires valid URL parameter');
        }
        break;
    }

    // Context-based validation
    if (context?.screenshot) {
      const { width, height } = context.screenshot;
      
      if (action.type === ActionType.CLICK || action.type === ActionType.DOUBLE_CLICK || action.type === ActionType.RIGHT_CLICK) {
        const { x, y } = action.parameters;
        if (x < 0 || x > width || y < 0 || y > height) {
          warnings.push(`Click coordinates (${x}, ${y}) are outside screen bounds (${width}x${height})`);
        }
      }
    }

    return this.createValidationResult(errors.length === 0, errors, warnings, suggestions);
  }

  protected async onCleanup(): Promise<void> {
    this.apiKey = undefined;
    this.baseUrl = undefined;
    this.modelName = undefined;
    this.log('info', 'OpenAI Vision model cleaned up');
  }

  private getSystemPrompt(): string {
    return `You are a GUI automation assistant that analyzes screenshots and generates precise actions to accomplish user tasks.

Your role:
1. Analyze the provided screenshot carefully
2. Understand the user's instruction
3. Generate a sequence of actions to accomplish the task
4. Provide clear reasoning for each action

Available actions:
- click: Click at specific coordinates
- double_click: Double-click at coordinates
- right_click: Right-click at coordinates
- drag: Drag from one point to another
- type: Type text
- key: Press keyboard keys
- scroll: Scroll in a direction
- wait: Wait for a duration
- navigate: Navigate to a URL (browser only)
- screenshot: Take a screenshot
- finished: Mark task as complete
- call_user: Ask user for clarification

Response format:
Provide your response as a JSON object with this structure:
{
  "reasoning": "Your step-by-step reasoning",
  "actions": [
    {
      "type": "action_type",
      "parameters": { "param1": "value1" },
      "description": "What this action does"
    }
  ],
  "confidence": 0.95
}

Guidelines:
- Be precise with coordinates
- Consider the current state of the UI
- Break complex tasks into simple steps
- Use wait actions when needed for UI updates
- Ask for clarification if the task is ambiguous`;
  }

  private formatUserPrompt(instruction: string, context?: ExecutionContext): string {
    let prompt = `Task: ${instruction}\n\n`;
    
    if (context?.previousActions && context.previousActions.length > 0) {
      prompt += `Previous actions taken:\n`;
      context.previousActions.forEach((action, index) => {
        prompt += `${index + 1}. ${action.type}: ${JSON.stringify(action.parameters)}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please analyze the screenshot and provide the next action(s) to accomplish this task.`;
    
    return prompt;
  }

  private async makeAPICall(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  private parseResponse(response: OpenAIResponse): ModelResponse {
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
        metadata: { rawResponse: content }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ModelError(`Failed to parse model response: ${errorMessage}`, {
        response: response.choices[0]?.message?.content
      });
    }
  }
}
