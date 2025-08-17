import { z } from 'zod';
import type {
  AgentConfig,
  AgentStatus,
  Session,
  Message,
  Action,
  ActionResult,
  Screenshot,
  Settings,
  Point
} from '@robin/core';

// IPC Request/Response types
export interface IPCRequest<T = any> {
  id: string;
  timestamp: number;
  data?: T;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// IPC Channel enum
export enum IPCChannel {
  // Agent control
  AGENT_START = 'agent:start',
  AGENT_PAUSE = 'agent:pause',
  AGENT_RESUME = 'agent:resume',
  AGENT_STOP = 'agent:stop',
  AGENT_STATUS = 'agent:status',

  // Screenshot
  SCREENSHOT_TAKE = 'screenshot:take',
  SCREENSHOT_REGION = 'screenshot:region',
  SCREENSHOT_GET_SCREEN_INFO = 'screenshot:getScreenInfo',

  // Settings
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',
  SETTINGS_RESET = 'settings:reset',

  // Sessions
  SESSION_CREATE = 'session:create',
  SESSION_GET = 'session:get',
  SESSION_LIST = 'session:list',
  SESSION_DELETE = 'session:delete',

  // System
  SYSTEM_INFO = 'system:info',
  APP_VERSION = 'app:version',

  // Window
  WINDOW_MINIMIZE = 'window:minimize',
  WINDOW_MAXIMIZE = 'window:maximize',
  WINDOW_CLOSE = 'window:close'
}

// Request types
export interface AgentStartRequest {
  agentType: string;
  instruction: string;
  config?: any;
}

export interface AgentControlRequest {
  agentId: string;
}

export interface SettingsRequest {
  category?: string;
  settings?: any;
}

export interface ScreenshotRequest {
  options?: any;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Zod schemas for runtime validation
export const PointSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.object({
    provider: z.string(),
    name: z.string(),
    apiKey: z.string(),
    baseUrl: z.string().optional(),
    version: z.string().optional(),
    parameters: z.record(z.any()).optional()
  }),
  operator: z.object({
    type: z.string(),
    settings: z.record(z.any())
  }),
  settings: z.object({
    maxIterations: z.number(),
    iterationDelay: z.number(),
    autoScreenshot: z.boolean(),
    confirmActions: z.boolean(),
    language: z.string()
  })
});

export const ActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  parameters: z.record(z.any()),
  timestamp: z.number(),
  description: z.string().optional()
});

export const MessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional(),
  screenshot: z.any().optional(), // Screenshot schema would be complex
  actions: z.array(ActionSchema).optional()
});

export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.any()).optional()
});

// IPC route definitions
export interface IPCRoutes {
  // Agent operations
  'agent:start': {
    input: AgentConfig;
    output: void;
  };
  'agent:execute': {
    input: { instruction: string; sessionId: string };
    output: ActionResult[];
  };
  'agent:pause': {
    input: void;
    output: void;
  };
  'agent:resume': {
    input: void;
    output: void;
  };
  'agent:stop': {
    input: void;
    output: void;
  };
  'agent:status': {
    input: void;
    output: AgentStatus;
  };

  // System operations
  'system:screenshot': {
    input: void;
    output: Screenshot;
  };
  'system:click': {
    input: Point;
    output: ActionResult;
  };
  'system:type': {
    input: { text: string };
    output: ActionResult;
  };
  'system:key': {
    input: { key: string; modifiers?: string[] };
    output: ActionResult;
  };

  // Session operations
  'session:create': {
    input: { name?: string };
    output: Session;
  };
  'session:load': {
    input: { id: string };
    output: Session;
  };
  'session:save': {
    input: Session;
    output: void;
  };
  'session:delete': {
    input: { id: string };
    output: void;
  };
  'session:list': {
    input: void;
    output: Session[];
  };

  // Settings operations
  'settings:get': {
    input: void;
    output: Settings;
  };
  'settings:update': {
    input: Partial<Settings>;
    output: void;
  };
  'settings:reset': {
    input: void;
    output: void;
  };

  // Window operations
  'window:minimize': {
    input: void;
    output: void;
  };
  'window:maximize': {
    input: void;
    output: void;
  };
  'window:close': {
    input: void;
    output: void;
  };
  'window:show': {
    input: void;
    output: void;
  };
  'window:hide': {
    input: void;
    output: void;
  };

  // File operations
  'file:select': {
    input: { filters?: Array<{ name: string; extensions: string[] }> };
    output: string | null;
  };
  'file:save': {
    input: { data: string; defaultPath?: string };
    output: string | null;
  };

  // Utility operations
  'app:version': {
    input: void;
    output: string;
  };
  'app:quit': {
    input: void;
    output: void;
  };
}

// Event definitions
export interface IPCEvents {
  // Agent events
  'agent:status-changed': AgentStatus;
  'agent:message': Message;
  'agent:action': Action;
  'agent:error': { error: string; details?: any };

  // System events
  'system:screenshot-captured': Screenshot;
  'system:action-completed': ActionResult;

  // Settings events
  'settings:changed': Settings;

  // Window events
  'window:focus': void;
  'window:blur': void;
  'window:resize': { width: number; height: number };

  // Application events
  'app:ready': void;
  'app:before-quit': void;
}

// Type helpers
export type IPCRouteKey = keyof IPCRoutes;
export type IPCEventKey = keyof IPCEvents;

export type IPCRouteInput<T extends IPCRouteKey> = IPCRoutes[T]['input'];
export type IPCRouteOutput<T extends IPCRouteKey> = IPCRoutes[T]['output'];

export type IPCEventPayload<T extends IPCEventKey> = IPCEvents[T];

// Error types
export class IPCError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

export class IPCValidationError extends IPCError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'IPCValidationError';
  }
}

export class IPCTimeoutError extends IPCError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'IPCTimeoutError';
  }
}
