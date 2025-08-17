import { Action, ActionType, ActionResult } from '../types';
import { ScreenOperator } from '../operators/screen-operator';
import { InputOperator } from '../operators/input-operator';

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export class ActionExecutor {
  constructor(
    private screenOperator: ScreenOperator,
    private inputOperator: InputOperator
  ) {}

  async executeAction(action: Action): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Executing action: ${action.type}`, action);
      
      let result: ExecutionResult;
      
      switch (action.type) {
        case ActionType.CLICK:
          result = await this.executeClick(action);
          break;
        case ActionType.DOUBLE_CLICK:
          result = await this.executeDoubleClick(action);
          break;
        case ActionType.RIGHT_CLICK:
          result = await this.executeRightClick(action);
          break;
        case ActionType.TYPE:
          result = await this.executeType(action);
          break;
        case ActionType.KEY:
          result = await this.executeKey(action);
          break;
        case ActionType.SCROLL:
          result = await this.executeScroll(action);
          break;
        case ActionType.DRAG:
          result = await this.executeDrag(action);
          break;
        case ActionType.WAIT:
          result = await this.executeWait(action);
          break;
        case ActionType.SCREENSHOT:
          result = await this.executeScreenshot();
          break;
        default:
          result = {
            success: false,
            error: `Unsupported action type: ${action.type}`
          };
      }
      
      result.duration = Date.now() - startTime;
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  private async executeClick(action: Action): Promise<ExecutionResult> {
    if (!action.coordinates) {
      return { success: false, error: 'Click action requires coordinates' };
    }

    try {
      await this.inputOperator.click(action.coordinates.x, action.coordinates.y);
      return {
        success: true,
        data: {
          action: 'click',
          coordinates: action.coordinates,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Click failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeDoubleClick(action: Action): Promise<ExecutionResult> {
    if (!action.coordinates) {
      return { success: false, error: 'Double-click action requires coordinates' };
    }

    try {
      await this.inputOperator.doubleClick(action.coordinates.x, action.coordinates.y);
      return {
        success: true,
        data: {
          action: 'double_click',
          coordinates: action.coordinates,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Double-click failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeRightClick(action: Action): Promise<ExecutionResult> {
    if (!action.coordinates) {
      return { success: false, error: 'Right-click action requires coordinates' };
    }

    try {
      await this.inputOperator.rightClick(action.coordinates.x, action.coordinates.y);
      return {
        success: true,
        data: {
          action: 'right_click',
          coordinates: action.coordinates,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Right-click failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeType(action: Action): Promise<ExecutionResult> {
    if (!action.text) {
      return { success: false, error: 'Type action requires text' };
    }

    try {
      await this.inputOperator.typeText(action.text);
      return {
        success: true,
        data: {
          action: 'type',
          text: action.text,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Type failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeKey(action: Action): Promise<ExecutionResult> {
    if (!action.parameters?.key) {
      return { success: false, error: 'Key action requires key parameter' };
    }

    try {
      const modifiers = action.parameters.modifiers || [];
      await this.inputOperator.key(action.parameters.key, modifiers);
      return {
        success: true,
        data: {
          action: 'key',
          key: action.parameters.key,
          modifiers: modifiers,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Key press failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeScroll(action: Action): Promise<ExecutionResult> {
    const direction = action.parameters?.direction || 'down';
    const amount = action.parameters?.amount || 3;
    const x = action.coordinates?.x || 500;
    const y = action.coordinates?.y || 500;

    try {
      await this.inputOperator.scroll(x, y, direction, amount);
      return {
        success: true,
        data: {
          action: 'scroll',
          direction: direction,
          amount: amount,
          coordinates: { x, y },
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeDrag(action: Action): Promise<ExecutionResult> {
    const from = action.parameters?.from;
    const to = action.parameters?.to;

    if (!from || !to) {
      return { success: false, error: 'Drag action requires from and to coordinates' };
    }

    try {
      await this.inputOperator.drag(from.x, from.y, to.x, to.y);
      return {
        success: true,
        data: {
          action: 'drag',
          from: from,
          to: to,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Drag failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeWait(action: Action): Promise<ExecutionResult> {
    const duration = action.parameters?.duration || 1000;

    try {
      await new Promise(resolve => setTimeout(resolve, duration));
      return {
        success: true,
        data: {
          action: 'wait',
          duration: duration,
          reasoning: action.reasoning
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Wait failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeScreenshot(): Promise<ExecutionResult> {
    try {
      const screenshot = await this.screenOperator.captureScreen();
      return {
        success: true,
        data: {
          action: 'screenshot',
          screenshot: {
            width: screenshot.width,
            height: screenshot.height,
            timestamp: screenshot.timestamp
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
