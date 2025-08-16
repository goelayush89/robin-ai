import { BaseOperator } from './base-operator';
import {
  OperatorType,
  OperatorCapability,
  Action,
  ActionResult,
  ActionType,
  Point,
  OperatorError
} from '../types';

export class InputOperator extends BaseOperator {
  private robotjs?: any; // Will be dynamically imported

  constructor() {
    const capabilities: OperatorCapability[] = [
      {
        action: ActionType.CLICK,
        description: 'Click at specified coordinates',
        supported: true,
        parameters: {
          x: { type: 'number', required: true },
          y: { type: 'number', required: true },
          button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' }
        }
      },
      {
        action: ActionType.DOUBLE_CLICK,
        description: 'Double-click at specified coordinates',
        supported: true,
        parameters: {
          x: { type: 'number', required: true },
          y: { type: 'number', required: true }
        }
      },
      {
        action: ActionType.RIGHT_CLICK,
        description: 'Right-click at specified coordinates',
        supported: true,
        parameters: {
          x: { type: 'number', required: true },
          y: { type: 'number', required: true }
        }
      },
      {
        action: ActionType.DRAG,
        description: 'Drag from one point to another',
        supported: true,
        parameters: {
          fromX: { type: 'number', required: true },
          fromY: { type: 'number', required: true },
          toX: { type: 'number', required: true },
          toY: { type: 'number', required: true }
        }
      },
      {
        action: ActionType.TYPE,
        description: 'Type text',
        supported: true,
        parameters: {
          text: { type: 'string', required: true }
        }
      },
      {
        action: ActionType.KEY,
        description: 'Press keyboard keys',
        supported: true,
        parameters: {
          key: { type: 'string', required: true },
          modifiers: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        action: ActionType.SCROLL,
        description: 'Scroll at specified coordinates',
        supported: true,
        parameters: {
          x: { type: 'number', required: true },
          y: { type: 'number', required: true },
          direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], default: 'down' },
          clicks: { type: 'number', default: 3 }
        }
      },
      {
        action: ActionType.WAIT,
        description: 'Wait for specified duration',
        supported: true,
        parameters: {
          duration: { type: 'number', required: true, min: 0 }
        }
      }
    ];

    super(OperatorType.LOCAL_COMPUTER, capabilities);
  }

  protected async onInitialize(config: Record<string, any>): Promise<void> {
    try {
      // Try to import robotjs for native input control
      try {
        this.robotjs = await import('robotjs' as any).catch(() => null);
        this.robotjs.setXDisplayName(process.env.DISPLAY || ':0');
        this._isInitialized = true;
        this.log('info', 'Input operator initialized with robotjs');
      } catch (error) {
        this.log('warn', 'robotjs not available, using fallback methods');
        this._isInitialized = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to initialize input operator: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(action: Action): Promise<ActionResult> {
    if (!this._isInitialized) {
      throw new OperatorError('Input operator not initialized');
    }

    try {
      switch (action.type) {
        case ActionType.CLICK:
          return await this.handleClick(action);
        case ActionType.DOUBLE_CLICK:
          return await this.handleDoubleClick(action);
        case ActionType.RIGHT_CLICK:
          return await this.handleRightClick(action);
        case ActionType.DRAG:
          return await this.handleDrag(action);
        case ActionType.TYPE:
          return await this.handleType(action);
        case ActionType.KEY:
          return await this.handleKey(action);
        case ActionType.SCROLL:
          return await this.handleScroll(action);
        case ActionType.WAIT:
          return await this.handleWait(action);
        default:
          throw new OperatorError(`Unsupported action type: ${action.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createActionResult(action.id, false, errorMessage);
    }
  }

  protected async onCapture(): Promise<any> {
    // Input operator doesn't capture screenshots directly
    throw new OperatorError('Input operator does not support screenshot capture');
  }

  protected async onCleanup(): Promise<void> {
    this.robotjs = undefined;
    this._isInitialized = false;
    this.log('info', 'Input operator cleaned up');
  }

  private async handleClick(action: Action): Promise<ActionResult> {
    const { x, y, button = 'left' } = action.parameters;
    
    if (!this.validatePoint({ x, y })) {
      throw new OperatorError('Invalid click coordinates');
    }

    if (this.robotjs) {
      this.robotjs.moveMouse(x, y);
      this.robotjs.mouseClick(button);
    } else {
      await this.clickFallback(x, y, button);
    }

    this.log('info', 'Click executed', { x, y, button });
    return this.createActionResult(action.id, true, undefined, { x, y, button });
  }

  private async handleDoubleClick(action: Action): Promise<ActionResult> {
    const { x, y } = action.parameters;
    
    if (!this.validatePoint({ x, y })) {
      throw new OperatorError('Invalid double-click coordinates');
    }

    if (this.robotjs) {
      this.robotjs.moveMouse(x, y);
      this.robotjs.mouseClick('left', true); // true for double-click
    } else {
      await this.doubleClickFallback(x, y);
    }

    this.log('info', 'Double-click executed', { x, y });
    return this.createActionResult(action.id, true, undefined, { x, y });
  }

  private async handleRightClick(action: Action): Promise<ActionResult> {
    const { x, y } = action.parameters;
    
    if (!this.validatePoint({ x, y })) {
      throw new OperatorError('Invalid right-click coordinates');
    }

    if (this.robotjs) {
      this.robotjs.moveMouse(x, y);
      this.robotjs.mouseClick('right');
    } else {
      await this.rightClickFallback(x, y);
    }

    this.log('info', 'Right-click executed', { x, y });
    return this.createActionResult(action.id, true, undefined, { x, y });
  }

  private async handleDrag(action: Action): Promise<ActionResult> {
    const { fromX, fromY, toX, toY } = action.parameters;
    
    if (!this.validatePoint({ x: fromX, y: fromY }) || !this.validatePoint({ x: toX, y: toY })) {
      throw new OperatorError('Invalid drag coordinates');
    }

    if (this.robotjs) {
      this.robotjs.moveMouse(fromX, fromY);
      this.robotjs.mouseToggle('down');
      this.robotjs.dragMouse(toX, toY);
      this.robotjs.mouseToggle('up');
    } else {
      await this.dragFallback(fromX, fromY, toX, toY);
    }

    this.log('info', 'Drag executed', { fromX, fromY, toX, toY });
    return this.createActionResult(action.id, true, undefined, { fromX, fromY, toX, toY });
  }

  private async handleType(action: Action): Promise<ActionResult> {
    const { text } = action.parameters;
    
    if (!text || typeof text !== 'string') {
      throw new OperatorError('Invalid text to type');
    }

    if (this.robotjs) {
      this.robotjs.typeString(text);
    } else {
      await this.typeFallback(text);
    }

    this.log('info', 'Text typed', { length: text.length });
    return this.createActionResult(action.id, true, undefined, { text: text.substring(0, 50) + '...' });
  }

  private async handleKey(action: Action): Promise<ActionResult> {
    const { key, modifiers = [] } = action.parameters;
    
    if (!key || typeof key !== 'string') {
      throw new OperatorError('Invalid key to press');
    }

    if (this.robotjs) {
      if (modifiers.length > 0) {
        this.robotjs.keyTap(key, modifiers);
      } else {
        this.robotjs.keyTap(key);
      }
    } else {
      await this.keyFallback(key, modifiers);
    }

    this.log('info', 'Key pressed', { key, modifiers });
    return this.createActionResult(action.id, true, undefined, { key, modifiers });
  }

  private async handleScroll(action: Action): Promise<ActionResult> {
    const { x, y, direction = 'down', clicks = 3 } = action.parameters;
    
    if (!this.validatePoint({ x, y })) {
      throw new OperatorError('Invalid scroll coordinates');
    }

    if (this.robotjs) {
      this.robotjs.moveMouse(x, y);
      const scrollDirection = direction === 'up' ? 'up' : 'down';
      this.robotjs.scrollMouse(clicks, scrollDirection);
    } else {
      await this.scrollFallback(x, y, direction, clicks);
    }

    this.log('info', 'Scroll executed', { x, y, direction, clicks });
    return this.createActionResult(action.id, true, undefined, { x, y, direction, clicks });
  }

  private async handleWait(action: Action): Promise<ActionResult> {
    const { duration } = action.parameters;
    
    if (typeof duration !== 'number' || duration < 0) {
      throw new OperatorError('Invalid wait duration');
    }

    await new Promise(resolve => setTimeout(resolve, duration));

    this.log('info', 'Wait completed', { duration });
    return this.createActionResult(action.id, true, undefined, { duration });
  }

  // Fallback methods for when robotjs is not available
  private async clickFallback(x: number, y: number, button: string): Promise<void> {
    // Platform-specific fallback implementations
    if (process.platform === 'win32') {
      await this.executeCommand('powershell', [
        '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`
      ]);
    } else if (process.platform === 'darwin') {
      await this.executeCommand('osascript', [
        '-e',
        `tell application "System Events" to click at {${x}, ${y}}`
      ]);
    } else {
      await this.executeCommand('xdotool', ['mousemove', x.toString(), y.toString(), 'click', '1']);
    }
  }

  private async doubleClickFallback(x: number, y: number): Promise<void> {
    await this.clickFallback(x, y, 'left');
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.clickFallback(x, y, 'left');
  }

  private async rightClickFallback(x: number, y: number): Promise<void> {
    if (process.platform === 'linux') {
      await this.executeCommand('xdotool', ['mousemove', x.toString(), y.toString(), 'click', '3']);
    } else {
      await this.clickFallback(x, y, 'right');
    }
  }

  private async dragFallback(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    if (process.platform === 'linux') {
      await this.executeCommand('xdotool', [
        'mousemove', fromX.toString(), fromY.toString(),
        'mousedown', '1',
        'mousemove', toX.toString(), toY.toString(),
        'mouseup', '1'
      ]);
    }
  }

  private async typeFallback(text: string): Promise<void> {
    if (process.platform === 'linux') {
      await this.executeCommand('xdotool', ['type', text]);
    } else if (process.platform === 'darwin') {
      await this.executeCommand('osascript', ['-e', `tell application "System Events" to keystroke "${text}"`]);
    }
  }

  private async keyFallback(key: string, modifiers: string[]): Promise<void> {
    if (process.platform === 'linux') {
      const args = ['key'];
      if (modifiers.length > 0) {
        args.push(modifiers.join('+') + '+' + key);
      } else {
        args.push(key);
      }
      await this.executeCommand('xdotool', args);
    }
  }

  private async scrollFallback(x: number, y: number, direction: string, clicks: number): Promise<void> {
    if (process.platform === 'linux') {
      const button = direction === 'up' ? '4' : '5';
      for (let i = 0; i < clicks; i++) {
        await this.executeCommand('xdotool', ['mousemove', x.toString(), y.toString(), 'click', button]);
      }
    }
  }

  private async executeCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const process = spawn(command, args);
      
      process.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
  }
}
