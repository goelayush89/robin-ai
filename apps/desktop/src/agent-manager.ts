import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import {
  LocalComputerAgent,
  WebBrowserAgent,
  HybridAgent,
  AgentConfig,
  AgentStatus,
  ActionResult,
  Screenshot,
  ExecutionContext,
  OperatorType
} from '@robin/core';
import { SettingsManager } from './settings-manager';

export interface AgentInstance {
  id: string;
  type: 'local' | 'browser' | 'hybrid';
  agent: LocalComputerAgent | WebBrowserAgent | HybridAgent;
  status: AgentStatus;
  config: AgentConfig;
  createdAt: number;
  lastActivity: number;
}

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private settingsManager: SettingsManager;
  private defaultAgentType: 'local' | 'browser' | 'hybrid' = 'hybrid';

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  async startAgent(
    type: 'local' | 'browser' | 'hybrid',
    instruction: string,
    config?: Partial<AgentConfig>
  ): Promise<{ agentId: string; status: AgentStatus }> {
    try {
      const agentId = uuidv4();
      log.info(`Starting ${type} agent with ID: ${agentId}`);

      // Get agent configuration
      const agentConfig = await this.createAgentConfig(type, config);
      
      // Create agent instance
      const agent = this.createAgentInstance(type);
      
      // Initialize agent
      await agent.initialize(agentConfig);
      
      // Create agent instance record
      const agentInstance: AgentInstance = {
        id: agentId,
        type,
        agent,
        status: AgentStatus.INITIALIZING,
        config: agentConfig,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      this.agents.set(agentId, agentInstance);

      // Setup event listeners
      this.setupAgentEventListeners(agentInstance);

      // Start execution
      const context: ExecutionContext = {
        sessionId: uuidv4(),
        previousActions: [],
        environment: {
          platform: process.platform,
          timestamp: Date.now()
        }
      };

      // Execute instruction in background
      this.executeAgentInstruction(agentInstance, instruction, context);

      return {
        agentId,
        status: AgentStatus.RUNNING
      };

    } catch (error) {
      log.error('Failed to start agent:', error);
      throw error;
    }
  }

  async pauseAgent(agentId: string): Promise<void> {
    const agentInstance = this.agents.get(agentId);
    if (!agentInstance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agentInstance.agent.pause();
    agentInstance.status = AgentStatus.PAUSED;
    agentInstance.lastActivity = Date.now();
    
    log.info(`Agent ${agentId} paused`);
  }

  async resumeAgent(agentId: string): Promise<void> {
    const agentInstance = this.agents.get(agentId);
    if (!agentInstance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agentInstance.agent.resume();
    agentInstance.status = AgentStatus.RUNNING;
    agentInstance.lastActivity = Date.now();
    
    log.info(`Agent ${agentId} resumed`);
  }

  async stopAgent(agentId: string): Promise<void> {
    const agentInstance = this.agents.get(agentId);
    if (!agentInstance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agentInstance.agent.stop();
    agentInstance.status = AgentStatus.STOPPED;
    agentInstance.lastActivity = Date.now();
    
    // Remove from active agents after a delay
    setTimeout(() => {
      this.agents.delete(agentId);
    }, 5000);
    
    log.info(`Agent ${agentId} stopped`);
  }

  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    const agentInstance = this.agents.get(agentId);
    if (!agentInstance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return agentInstance.status;
  }

  async takeScreenshot(options?: any): Promise<Screenshot> {
    // Use the first available agent or create a temporary one
    const activeAgent = Array.from(this.agents.values())[0];
    
    if (activeAgent) {
      if (activeAgent.type === 'local' && activeAgent.agent instanceof LocalComputerAgent) {
        return activeAgent.agent.takeScreenshot();
      } else if (activeAgent.type === 'browser' && activeAgent.agent instanceof WebBrowserAgent) {
        return activeAgent.agent.takeScreenshot();
      } else if (activeAgent.type === 'hybrid' && activeAgent.agent instanceof HybridAgent) {
        return activeAgent.agent.takeScreenshot();
      }
    }

    // Create temporary agent for screenshot
    const tempAgent = new LocalComputerAgent();
    const config = await this.createAgentConfig('local');
    await tempAgent.initialize(config);
    
    try {
      const screenshot = await tempAgent.takeScreenshot();
      await tempAgent.stop();
      return screenshot;
    } catch (error) {
      await tempAgent.stop();
      throw error;
    }
  }

  async takeRegionScreenshot(options: any): Promise<Screenshot> {
    // Similar to takeScreenshot but with region options
    return this.takeScreenshot(options);
  }

  async takeQuickScreenshot(): Promise<void> {
    try {
      const screenshot = await this.takeScreenshot();
      log.info('Quick screenshot taken:', screenshot.timestamp);
      
      // Could save to clipboard or show notification
      // This would be implemented based on requirements
    } catch (error) {
      log.error('Failed to take quick screenshot:', error);
    }
  }

  async startDefaultAgent(): Promise<void> {
    const instruction = "I'm ready to help. What would you like me to do?";
    await this.startAgent(this.defaultAgentType, instruction);
  }

  async pauseAllAgents(): Promise<void> {
    const pausePromises = Array.from(this.agents.keys()).map(agentId => 
      this.pauseAgent(agentId).catch(error => 
        log.error(`Failed to pause agent ${agentId}:`, error)
      )
    );
    
    await Promise.all(pausePromises);
    log.info('All agents paused');
  }

  async resumeAllAgents(): Promise<void> {
    const resumePromises = Array.from(this.agents.values())
      .filter(agent => agent.status === AgentStatus.PAUSED)
      .map(agent => 
        this.resumeAgent(agent.id).catch(error => 
          log.error(`Failed to resume agent ${agent.id}:`, error)
        )
      );
    
    await Promise.all(resumePromises);
    log.info('All paused agents resumed');
  }

  async stopAllAgents(): Promise<void> {
    const stopPromises = Array.from(this.agents.keys()).map(agentId => 
      this.stopAgent(agentId).catch(error => 
        log.error(`Failed to stop agent ${agentId}:`, error)
      )
    );
    
    await Promise.all(stopPromises);
    log.info('All agents stopped');
  }

  getActiveAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.status === AgentStatus.RUNNING || agent.status === AgentStatus.PAUSED
    );
  }

  cleanup(): void {
    log.info('Cleaning up agent manager...');
    this.stopAllAgents();
  }

  private createAgentInstance(type: 'local' | 'browser' | 'hybrid'): LocalComputerAgent | WebBrowserAgent | HybridAgent {
    switch (type) {
      case 'local':
        return new LocalComputerAgent();
      case 'browser':
        return new WebBrowserAgent();
      case 'hybrid':
        return new HybridAgent();
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  private async createAgentConfig(type: 'local' | 'browser' | 'hybrid', overrides?: Partial<AgentConfig>): Promise<AgentConfig> {
    const settings = await this.settingsManager.getSettings('agent');
    
    const baseConfig: AgentConfig = {
      id: uuidv4(),
      name: `${type}-agent`,
      model: settings.model || {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
        apiKey: '',
        version: '1.0'
      },
      operator: {
        type: type === 'local' ? OperatorType.LOCAL_COMPUTER : type === 'browser' ? OperatorType.WEB_BROWSER : OperatorType.HYBRID,
        settings: settings.operator || {}
      },
      settings: {
        maxIterations: settings.maxIterations || 10,
        iterationDelay: settings.iterationDelay || 1000,
        ...settings.general
      }
    };

    return { ...baseConfig, ...overrides };
  }

  private setupAgentEventListeners(agentInstance: AgentInstance): void {
    const { agent, id } = agentInstance;

    agent.on('status-changed', (status: AgentStatus) => {
      agentInstance.status = status;
      agentInstance.lastActivity = Date.now();
      log.info(`Agent ${id} status changed to: ${status}`);
    });

    agent.on('action-completed', (result: ActionResult) => {
      agentInstance.lastActivity = Date.now();
      log.debug(`Agent ${id} completed action:`, result);
    });

    agent.on('error', (error: Error) => {
      agentInstance.status = AgentStatus.ERROR;
      agentInstance.lastActivity = Date.now();
      log.error(`Agent ${id} error:`, error);
    });

    agent.on('finished', () => {
      agentInstance.status = AgentStatus.IDLE;
      agentInstance.lastActivity = Date.now();
      log.info(`Agent ${id} finished execution`);
    });
  }

  private async executeAgentInstruction(
    agentInstance: AgentInstance,
    instruction: string,
    context: ExecutionContext
  ): Promise<void> {
    try {
      agentInstance.status = AgentStatus.RUNNING;
      const results = await agentInstance.agent.execute(instruction, context);
      
      log.info(`Agent ${agentInstance.id} completed execution with ${results.length} results`);
      agentInstance.status = AgentStatus.IDLE;
      
    } catch (error) {
      log.error(`Agent ${agentInstance.id} execution failed:`, error);
      agentInstance.status = AgentStatus.ERROR;
    } finally {
      agentInstance.lastActivity = Date.now();
    }
  }
}
