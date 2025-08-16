import { BaseOperator } from './base-operator';
import {
  OperatorType,
  OperatorCapability,
  Action,
  ActionResult,
  ActionType,
  Screenshot,
  OperatorError
} from '../types';

export class BrowserOperator extends BaseOperator {
  private browser?: any;
  private page?: any;
  private puppeteer?: any;

  constructor() {
    const capabilities: OperatorCapability[] = [
      {
        action: ActionType.NAVIGATE,
        description: 'Navigate to a URL',
        supported: true,
        parameters: {
          url: { type: 'string', required: true }
        }
      },
      {
        action: ActionType.CLICK,
        description: 'Click on an element',
        supported: true,
        parameters: {
          selector: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' }
        }
      },
      {
        action: ActionType.TYPE,
        description: 'Type text into an input field',
        supported: true,
        parameters: {
          selector: { type: 'string' },
          text: { type: 'string', required: true }
        }
      },
      {
        action: ActionType.SCROLL,
        description: 'Scroll the page',
        supported: true,
        parameters: {
          direction: { type: 'string', enum: ['up', 'down'], default: 'down' },
          amount: { type: 'number', default: 500 }
        }
      },
      {
        action: ActionType.SCREENSHOT,
        description: 'Take a screenshot of the page',
        supported: true,
        parameters: {
          fullPage: { type: 'boolean', default: false }
        }
      },
      {
        action: ActionType.WAIT,
        description: 'Wait for an element or duration',
        supported: true,
        parameters: {
          selector: { type: 'string' },
          duration: { type: 'number' },
          timeout: { type: 'number', default: 30000 }
        }
      }
    ];

    super(OperatorType.WEB_BROWSER, capabilities);
  }

  protected async onInitialize(config: Record<string, any>): Promise<void> {
    try {
      // Try to import puppeteer
      try {
        this.puppeteer = await import('puppeteer' as any).catch(() => null);
        if (!this.puppeteer) {
          // Fallback to puppeteer-core
          this.puppeteer = await import('puppeteer-core' as any).catch(() => null);
        }
      } catch (error) {
        this.puppeteer = null;
      }

      if (!this.puppeteer) {
        throw new OperatorError('Neither puppeteer nor puppeteer-core is available');
      }

      // Launch browser
      this.browser = await this.puppeteer.launch({
        headless: config.headless !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        executablePath: config.executablePath
      });

      // Create a new page
      this.page = await this.browser.newPage();
      
      // Set viewport
      await this.page.setViewport({
        width: config.width || 1920,
        height: config.height || 1080
      });

      // Set user agent
      if (config.userAgent) {
        await this.page.setUserAgent(config.userAgent);
      }

      this.log('info', 'Browser operator initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to initialize browser: ${errorMessage}`, { error });
    }
  }

  protected async onExecute(action: Action): Promise<ActionResult> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }

    try {
      switch (action.type) {
        case ActionType.NAVIGATE:
          return await this.handleNavigate(action);
        case ActionType.CLICK:
          return await this.handleClick(action);
        case ActionType.TYPE:
          return await this.handleType(action);
        case ActionType.SCROLL:
          return await this.handleScroll(action);
        case ActionType.SCREENSHOT:
          return await this.handleScreenshot(action);
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

  protected async onCapture(): Promise<Screenshot> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }

    try {
      const screenshot = await this.page.screenshot({
        type: 'png',
        fullPage: false
      });

      const viewport = this.page.viewport();
      return this.createScreenshot(
        screenshot,
        viewport.width,
        viewport.height,
        'png'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OperatorError(`Failed to capture browser screenshot: ${errorMessage}`, { error });
    }
  }

  protected async onCleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = undefined;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = undefined;
      }
      
      this.log('info', 'Browser operator cleaned up');
    } catch (error) {
      this.log('warn', 'Error during browser cleanup', { error });
    }
  }

  private async handleNavigate(action: Action): Promise<ActionResult> {
    const { url } = action.parameters;
    
    if (!url || typeof url !== 'string') {
      throw new OperatorError('Invalid URL for navigation');
    }

    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    const currentUrl = this.page.url();
    this.log('info', 'Navigation completed', { url: currentUrl });
    
    return this.createActionResult(action.id, true, undefined, { url: currentUrl });
  }

  private async handleClick(action: Action): Promise<ActionResult> {
    const { selector, x, y } = action.parameters;
    
    if (selector) {
      // Click by selector
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      this.log('info', 'Element clicked', { selector });
    } else if (x !== undefined && y !== undefined) {
      // Click by coordinates
      await this.page.mouse.click(x, y);
      this.log('info', 'Coordinate clicked', { x, y });
    } else {
      throw new OperatorError('Either selector or coordinates must be provided for click');
    }
    
    return this.createActionResult(action.id, true, undefined, { selector, x, y });
  }

  private async handleType(action: Action): Promise<ActionResult> {
    const { selector, text } = action.parameters;
    
    if (!text || typeof text !== 'string') {
      throw new OperatorError('Invalid text to type');
    }

    if (selector) {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.focus(selector);
      await this.page.keyboard.type(text);
    } else {
      await this.page.keyboard.type(text);
    }
    
    this.log('info', 'Text typed', { selector, length: text.length });
    return this.createActionResult(action.id, true, undefined, { selector, text: text.substring(0, 50) + '...' });
  }

  private async handleScroll(action: Action): Promise<ActionResult> {
    const { direction = 'down', amount = 500 } = action.parameters;
    
    const scrollAmount = direction === 'up' ? -amount : amount;
    
    await this.page.evaluate((scrollY: number) => {
      window.scrollBy(0, scrollY);
    }, scrollAmount);
    
    this.log('info', 'Page scrolled', { direction, amount });
    return this.createActionResult(action.id, true, undefined, { direction, amount });
  }

  private async handleScreenshot(action: Action): Promise<ActionResult> {
    const { fullPage = false } = action.parameters;
    
    const screenshot = await this.page.screenshot({
      type: 'png',
      fullPage
    });

    const viewport = this.page.viewport();
    const screenshotObj = this.createScreenshot(
      screenshot,
      viewport.width,
      viewport.height,
      'png'
    );
    
    this.log('info', 'Screenshot captured', { fullPage });
    return this.createActionResult(action.id, true, undefined, { fullPage }, screenshotObj);
  }

  private async handleWait(action: Action): Promise<ActionResult> {
    const { selector, duration, timeout = 30000 } = action.parameters;
    
    if (selector) {
      await this.page.waitForSelector(selector, { timeout });
      this.log('info', 'Waited for selector', { selector });
    } else if (duration) {
      await new Promise(resolve => setTimeout(resolve, duration));
      this.log('info', 'Waited for duration', { duration });
    } else {
      throw new OperatorError('Either selector or duration must be provided for wait');
    }
    
    return this.createActionResult(action.id, true, undefined, { selector, duration });
  }

  // Additional browser-specific methods
  public async getCurrentUrl(): Promise<string> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    return this.page.url();
  }

  public async getPageTitle(): Promise<string> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    return this.page.title();
  }

  public async evaluateScript(script: string): Promise<any> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    return this.page.evaluate(script);
  }

  public async getElementText(selector: string): Promise<string> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    
    const element = await this.page.$(selector);
    if (!element) {
      throw new OperatorError(`Element not found: ${selector}`);
    }
    
    return this.page.evaluate((el: any) => el.textContent, element);
  }

  public async getElementAttribute(selector: string, attribute: string): Promise<string | null> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    
    const element = await this.page.$(selector);
    if (!element) {
      throw new OperatorError(`Element not found: ${selector}`);
    }
    
    return this.page.evaluate((el: any, attr: string) => el.getAttribute(attr), element, attribute);
  }

  public async isElementVisible(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new OperatorError('Browser not initialized');
    }
    
    try {
      const element = await this.page.$(selector);
      if (!element) {
        return false;
      }
      
      return this.page.evaluate((el: any) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }, element);
    } catch (error) {
      return false;
    }
  }
}
