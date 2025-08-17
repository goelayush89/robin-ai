import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { agentService } from '../services/agent-service';
// Browser-compatible type definitions
export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
}

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface Screenshot {
  data: string;
  width: number;
  height: number;
  timestamp: number;
}

export interface ActionResult {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  screenshot?: Screenshot;
  actionResults?: ActionResult[];
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  model: any;
  operator: any;
  settings: any;
}

export interface AgentStore {
  // Agent state
  currentAgent: string | null;
  agentStatus: AgentStatus;
  agentConfig: AgentConfig | null;
  
  // Session state
  currentSession: Session | null;
  sessions: Session[];
  messages: Message[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  lastScreenshot: Screenshot | null;
  
  // Actions
  setCurrentAgent: (agentId: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setAgentConfig: (config: AgentConfig) => void;
  
  // Session actions
  createSession: (name?: string) => Session;
  setCurrentSession: (session: Session) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastScreenshot: (screenshot: Screenshot | null) => void;
  
  // Agent control
  startAgent: (instruction: string) => Promise<void>;
  pauseAgent: () => Promise<void>;
  resumeAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentAgent: null,
      agentStatus: AgentStatus.IDLE,
      agentConfig: null,
      currentSession: null,
      sessions: [],
      messages: [],
      isLoading: false,
      error: null,
      lastScreenshot: null,

      // Agent actions
      setCurrentAgent: (agentId: string) => {
        set({ currentAgent: agentId });
      },

      setAgentStatus: (status: AgentStatus) => {
        set({ agentStatus: status });
      },

      setAgentConfig: (config: AgentConfig) => {
        set({ agentConfig: config });
      },

      // Session actions
      createSession: (name?: string) => {
        const session: Session = {
          id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Session ${new Date().toLocaleString()}`,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        set(state => ({
          sessions: [...state.sessions, session],
          currentSession: session,
          messages: []
        }));

        return session;
      },

      setCurrentSession: (session: Session) => {
        set({
          currentSession: session,
          messages: session.messages
        });
      },

      addMessage: (message: Message) => {
        set(state => {
          const newMessages = [...state.messages, message];
          const updatedSession = state.currentSession ? {
            ...state.currentSession,
            messages: newMessages,
            updatedAt: Date.now()
          } : null;

          return {
            messages: newMessages,
            currentSession: updatedSession,
            sessions: state.sessions.map(s => 
              s.id === updatedSession?.id ? updatedSession : s
            )
          };
        });
      },

      clearMessages: () => {
        set(state => {
          const updatedSession = state.currentSession ? {
            ...state.currentSession,
            messages: [],
            updatedAt: Date.now()
          } : null;

          return {
            messages: [],
            currentSession: updatedSession,
            sessions: state.sessions.map(s => 
              s.id === updatedSession?.id ? updatedSession : s
            )
          };
        });
      },

      // UI actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLastScreenshot: (screenshot: Screenshot | null) => {
        set({ lastScreenshot: screenshot });
      },

      // Agent control actions
      startAgent: async (instruction: string) => {
        const state = get();

        if (!state.agentConfig) {
          throw new Error('No agent configuration available');
        }

        try {
          set({ isLoading: true, error: null, agentStatus: AgentStatus.INITIALIZING });

          // Initialize agent if not already done
          await agentService.initializeAgent(state.agentConfig);

          // Create user message
          const userMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: MessageType.USER,
            content: instruction,
            timestamp: Date.now()
          };

          get().addMessage(userMessage);

          // Set up event listeners for real-time updates
          agentService.addEventListener('screenshot-captured', (data: any) => {
            set({ lastScreenshot: data.screenshot });
          });

          agentService.addEventListener('analysis-completed', (data: any) => {
            const analysisMessage: Message = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: MessageType.ASSISTANT,
              content: `Analysis: ${data.response.reasoning}`,
              timestamp: Date.now()
            };
            get().addMessage(analysisMessage);
          });

          agentService.addEventListener('action-completed', (data: any) => {
            const actionMessage: Message = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: MessageType.SYSTEM,
              content: `Action ${data.action.type}: ${data.result.success ? 'Success' : 'Failed'}`,
              timestamp: Date.now(),
              actionResults: [data.result]
            };
            get().addMessage(actionMessage);
          });

          set({ agentStatus: AgentStatus.RUNNING });

          // Execute the instruction using real AI agent
          const result = await agentService.executeInstruction(instruction);

          if (result.success) {
            const successMessage: Message = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: MessageType.ASSISTANT,
              content: `Task completed successfully! Executed ${result.results.length} actions.`,
              timestamp: Date.now(),
              actionResults: result.results,
              screenshot: result.screenshots[result.screenshots.length - 1]
            };
            get().addMessage(successMessage);
            set({ agentStatus: AgentStatus.IDLE });
          } else {
            throw new Error(result.error || 'Agent execution failed');
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorMsg: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: MessageType.SYSTEM,
            content: `Error: ${errorMessage}`,
            timestamp: Date.now()
          };
          get().addMessage(errorMsg);
          set({ error: errorMessage, agentStatus: AgentStatus.ERROR });
        } finally {
          set({ isLoading: false });
        }
      },

      pauseAgent: async () => {
        try {
          set({ isLoading: true });
          await agentService.pauseAgent();
          set({ agentStatus: AgentStatus.PAUSED });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set({ error: errorMessage });
        } finally {
          set({ isLoading: false });
        }
      },

      resumeAgent: async () => {
        try {
          set({ isLoading: true });
          await agentService.resumeAgent();
          set({ agentStatus: AgentStatus.RUNNING });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set({ error: errorMessage });
        } finally {
          set({ isLoading: false });
        }
      },

      stopAgent: async () => {
        try {
          set({ isLoading: true });
          await agentService.stopAgent();
          set({ agentStatus: AgentStatus.IDLE });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set({ error: errorMessage });
        } finally {
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'robin-agent-store',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
        agentConfig: state.agentConfig
      })
    }
  )
);
