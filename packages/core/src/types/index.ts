// Core types for Robin Assistant

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Screenshot {
  id: string;
  data: Buffer;
  width: number;
  height: number;
  timestamp: number;
  format: 'png' | 'jpeg';
}

export interface Action {
  id: string;
  type: ActionType;
  parameters: Record<string, any>;
  timestamp: number;
  description?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  reasoning?: string;
}

export enum ActionType {
  CLICK = 'click',
  DOUBLE_CLICK = 'double_click',
  RIGHT_CLICK = 'right_click',
  DRAG = 'drag',
  TYPE = 'type',
  KEY = 'key',
  SCROLL = 'scroll',
  WAIT = 'wait',
  SCREENSHOT = 'screenshot',
  NAVIGATE = 'navigate',
  FINISHED = 'finished',
  CALL_USER = 'call_user'
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  error?: string;
  screenshot?: Screenshot;
  data?: any;
  timestamp: number;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
  screenshot?: Screenshot;
  actions?: Action[];
}

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  ERROR = 'error'
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  id: string;
  name: string;
  model: ModelConfig;
  operator: OperatorConfig;
  settings: AgentSettings;
}

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
  apiKey: string;
  baseUrl?: string;
  version?: string;
  parameters?: Record<string, any>;
}

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  LOCAL = 'local',
  CUSTOM = 'custom'
}

export interface OperatorConfig {
  type: OperatorType;
  settings: Record<string, any>;
}

export enum OperatorType {
  LOCAL_COMPUTER = 'local_computer',
  WEB_BROWSER = 'web_browser',
  HYBRID = 'hybrid'
}

export interface AgentSettings {
  maxIterations: number;
  iterationDelay: number;
  autoScreenshot: boolean;
  confirmActions: boolean;
  language: string;
}

export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
}

export interface AgentCapability {
  name: string;
  description: string;
  supported: boolean;
  requirements?: string[];
}

export interface OperatorCapability {
  action: ActionType;
  description: string;
  supported: boolean;
  parameters?: Record<string, any>;
}

export interface ExecutionContext {
  sessionId: string;
  screenshot?: Screenshot;
  previousActions: Action[];
  environment: Record<string, any>;
}

export interface ModelResponse {
  reasoning?: string;
  actions: Action[];
  confidence: number;
  metadata?: Record<string, any>;
}

export interface AnalysisContext {
  instruction: string;
  screenshot: Screenshot;
  previousActions?: Action[];
  environment?: Record<string, any>;
  constraints?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface Settings {
  appearance: AppearanceSettings;
  privacy: PrivacySettings;
  advanced: AdvancedSettings;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontSize: number;
  animations: boolean;
}

export interface PrivacySettings {
  telemetry: boolean;
  crashReports: boolean;
  analytics: boolean;
  dataRetention: number; // days
}

export interface AdvancedSettings {
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxMemoryUsage: number; // MB
  networkTimeout: number; // seconds
}

// Message and Session types
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

// Event types
export interface AgentEvent {
  type: string;
  payload: any;
  timestamp: number;
}

export interface SystemEvent {
  type: string;
  data: any;
  timestamp: number;
}

// Error types
export class RobinError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'RobinError';
  }
}

export class AgentError extends RobinError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AGENT_ERROR', details);
    this.name = 'AgentError';
  }
}

export class OperatorError extends RobinError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'OPERATOR_ERROR', details);
    this.name = 'OperatorError';
  }
}

export class ModelError extends RobinError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'MODEL_ERROR', details);
    this.name = 'ModelError';
  }
}
