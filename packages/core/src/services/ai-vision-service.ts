import { Screenshot, Action, ActionType } from '../types';

export interface AIAnalysisResult {
  reasoning: string;
  confidence: number;
  isComplete: boolean;
  actions: Action[];
  nextSteps?: string[];
  errors?: string[];
}

export interface AIVisionConfig {
  provider: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIVisionService {
  private config?: AIVisionConfig;
  private isInitialized = false;

  async initialize(config: AIVisionConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
  }

  async analyzeScreenshot(
    screenshot: Screenshot,
    instruction: string,
    iteration: number,
    previousResults: any[]
  ): Promise<AIAnalysisResult> {
    if (!this.isInitialized || !this.config) {
      throw new Error('AI Vision Service not initialized');
    }

    const prompt = this.buildAnalysisPrompt(instruction, iteration, previousResults);
    
    try {
      const response = await this.callAIModel(prompt, screenshot);
      return this.parseAIResponse(response);
    } catch (error) {
      console.error('AI Vision analysis failed:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildAnalysisPrompt(instruction: string, iteration: number, previousResults: any[]): string {
    const previousActions = previousResults
      .filter(r => r.data?.action && r.data.action !== 'screenshot' && r.data.action !== 'ai_analysis')
      .map(r => `- ${r.data.action}: ${r.success ? 'SUCCESS' : 'FAILED'}`)
      .join('\n');

    return `You are Robin Assistant, an AI automation agent that can see and control computer screens.

TASK: ${instruction}
ITERATION: ${iteration}
PREVIOUS ACTIONS:
${previousActions || 'None'}

Analyze the screenshot and determine the next actions needed to complete the task.

AVAILABLE ACTIONS:
- CLICK: Click at specific coordinates {x, y}
- DOUBLE_CLICK: Double-click at coordinates
- RIGHT_CLICK: Right-click at coordinates  
- TYPE: Type text into focused element
- KEY: Press keyboard keys (combinations like "ctrl+c")
- SCROLL: Scroll in direction {direction: "up"|"down"|"left"|"right", amount: number}
- WAIT: Wait for specified milliseconds
- DRAG: Drag from one point to another {from: {x, y}, to: {x, y}}

RESPONSE FORMAT (JSON):
{
  "reasoning": "Detailed analysis of what you see and why you're taking these actions",
  "confidence": 0.95,
  "isComplete": false,
  "actions": [
    {
      "type": "CLICK",
      "coordinates": {"x": 100, "y": 200},
      "reasoning": "Clicking on the submit button to proceed"
    }
  ],
  "nextSteps": ["Optional array of planned future steps"]
}

IMPORTANT RULES:
1. Always provide detailed reasoning for your actions
2. Set isComplete=true only when the task is fully accomplished
3. Use precise coordinates based on what you see in the screenshot
4. If you can't see the target element, try scrolling or looking for it
5. If the task seems impossible, explain why in reasoning
6. Maximum 3 actions per iteration to avoid overwhelming the system
7. Always consider the current state and previous actions to avoid loops

Analyze the screenshot and respond with the JSON format above.`;
  }

  private async callAIModel(prompt: string, screenshot: Screenshot): Promise<string> {
    if (!this.config) {
      throw new Error('AI config not available');
    }

    const imageData = screenshot.data.startsWith('data:') 
      ? screenshot.data 
      : `data:image/png;base64,${screenshot.data}`;

    switch (this.config.provider.toLowerCase()) {
      case 'openai':
        return this.callOpenAI(prompt, imageData);
      case 'anthropic':
        return this.callAnthropic(prompt, imageData);
      case 'openrouter':
        return this.callOpenRouter(prompt, imageData);
      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
  }

  private async callOpenAI(prompt: string, imageData: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config!.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageData } }
            ]
          }
        ],
        max_tokens: this.config!.maxTokens || 2000,
        temperature: this.config!.temperature || 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenAI';
  }

  private async callAnthropic(prompt: string, imageData: string): Promise<string> {
    const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config!.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config!.model,
        max_tokens: this.config!.maxTokens || 2000,
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
                  data: base64Data
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

  private async callOpenRouter(prompt: string, imageData: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://robin-assistant.com',
        'X-Title': 'Robin Assistant'
      },
      body: JSON.stringify({
        model: this.config!.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageData } }
            ]
          }
        ],
        max_tokens: this.config!.maxTokens || 2000,
        temperature: this.config!.temperature || 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenRouter';
  }

  private parseAIResponse(response: string): AIAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.reasoning || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response format');
      }

      // Ensure actions have proper structure
      if (parsed.actions) {
        parsed.actions = parsed.actions.map((action: any, index: number) => ({
          id: `action-${Date.now()}-${index}`,
          type: action.type as ActionType,
          coordinates: action.coordinates,
          text: action.text,
          parameters: action.parameters || {},
          reasoning: action.reasoning || 'No reasoning provided'
        }));
      }

      return {
        reasoning: parsed.reasoning,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        isComplete: Boolean(parsed.isComplete),
        actions: parsed.actions || [],
        nextSteps: parsed.nextSteps,
        errors: parsed.errors
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', response);
      
      // Fallback response
      return {
        reasoning: `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}. Raw response: ${response.substring(0, 200)}...`,
        confidence: 0.1,
        isComplete: false,
        actions: [],
        errors: ['Failed to parse AI response']
      };
    }
  }
}
