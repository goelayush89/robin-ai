import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
          set({ isLoading: true, error: null });

          // Create user message
          const userMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: MessageType.USER,
            content: instruction,
            timestamp: Date.now()
          };

          get().addMessage(userMessage);

          // This would be replaced with actual IPC call to Electron
          // For now, simulate the agent execution
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Create assistant response
          const assistantMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: MessageType.ASSISTANT,
            content: 'I understand your request. Let me analyze the screen and execute the necessary actions.',
            timestamp: Date.now()
          };

          get().addMessage(assistantMessage);
          set({ agentStatus: AgentStatus.RUNNING });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set({ error: errorMessage });
        } finally {
          set({ isLoading: false });
        }
      },

      pauseAgent: async () => {
        try {
          set({ isLoading: true });
          // IPC call to pause agent
          await new Promise(resolve => setTimeout(resolve, 500));
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
          // IPC call to resume agent
          await new Promise(resolve => setTimeout(resolve, 500));
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
          // IPC call to stop agent
          await new Promise(resolve => setTimeout(resolve, 500));
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
