export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isLoading?: boolean;
  error?: string;
  metadata?: {
    isStreaming?: boolean;
    isPlaceholder?: boolean;
    provider?: string;
    model?: string;
    tokens?: number;
    executionTime?: number;
    [key: string]: any;
  };
}
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  currentInput: string;
}
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  fontSize: 'small' | 'medium' | 'large';
  enableNotifications: boolean;
  enableSounds: boolean;
  autoSave: boolean;
}
export interface SystemInfo {
  os: string;
  arch: string;
  version: string;
  timestamp: string;
}
export interface LegacyPluginRegistry {
  [pluginName: string]: Plugin;
}
export interface AppVersion {
  version: string;
  name: string;
  build_date: string;
}
export interface AppState {
  isInitialized: boolean;
  systemInfo: SystemInfo | null;
  appVersion: AppVersion | null;
  preferences: UserPreferences;
}
export type Theme = 'light' | 'dark' | 'system';
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}
export interface ChatActions {
  addMessage: (content: string, role: 'user' | 'assistant', customId?: string | number) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentInput: (input: string) => void;
}
export interface PreferenceActions {
  setTheme: (theme: Theme) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  toggleNotifications: () => void;
  toggleSounds: () => void;
  toggleAutoSave: () => void;
  resetPreferences: () => void;
}
export interface SttResult {
  text: string;
  confidence: number;
  success: boolean;
}
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: ChatSessionMetadata;
}
export interface ChatSessionMetadata {
  model?: string;
  tokenCount?: number;
  messageCount?: number;
  lastActivity?: Date;
  tags?: string[];
  isArchived?: boolean;
}
export interface ChatSessionSummary {
  id: string;
  title: string;
  lastMessage?: string | null;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived?: boolean;
  metadata?: ChatSessionMetadata;
}
export interface MultiChatState extends ChatState {
  activeChatId: string | null;
  chatSessions: Record<string, ChatSession>;
  chatSummaries: ChatSessionSummary[];
}
export interface ChatSessionActions {
  createNewChat: (title?: string) => Promise<string>;
  switchToChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  archiveChat: (chatId: string) => Promise<void>;
  loadChatSessions: () => Promise<void>;
  saveChatSession: (chatId: string, session?: ChatSession) => Promise<void>;
  duplicateChat: (chatId: string) => Promise<string>;
  generateContextAwareResponse: (prompt: string, systemPrompt?: string) => Promise<string>;
  saveMessageToBackend: (chatId: string, content: string, role: 'user' | 'assistant') => Promise<void>;
}
export interface HardwareInfo {
  hasGPU: boolean;
  gpuName?: string;
  vramTotal?: number;
  vramAvailable?: number;
  cpuCores: number;
  ramTotal?: number;
  ramAvailable?: number;
}
export type RuntimeMode = 'gpu' | 'hybrid' | 'cpu';
export interface RuntimeConfig {
  mode: RuntimeMode;
  reason: string;
  ollamaArgs?: string[];
  hardwareInfo: HardwareInfo;
}
export interface TokenInfo {
  count: number;
  limit: number;
  percentage: number;
}
export interface ContextWindow {
  messages: Message[];
  tokenInfo: TokenInfo;
  truncatedCount: number;
}
export interface ConversationContext {
  chatId: string;
  contextWindow: ContextWindow;
  systemPrompt?: string;
  model: string;
}
export interface PluginManifest {
  name: string;
  description: string;
  version: string;
  author?: string;
  keywords: string[];
  triggerWords: string[];
  category: 'productivity' | 'utility' | 'system' | 'file' | 'other';
  permissions?: string[];
  examples?: string[];
}
export interface PluginResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}
export interface Plugin {
  manifest: PluginManifest;
  run: (input: string, context?: PluginContext) => Promise<PluginResult>;
}
export interface PluginContext {
  chatId?: string;
  userId?: string;
  timestamp: Date;
  workingDirectory?: string;
}
export interface PluginRegistry {
  [pluginName: string]: Plugin;
}
export type LLMProvider = 'local' | 'online' | 'plugin';
export type LLMModel = 'gemma3n' | 'gemma3n:latest' | 'gemini-api' | 'gemini-1.5-flash';
export interface LLMConfig {
  provider: LLMProvider;
  model: LLMModel;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
}
export interface LLMRoutingPreferences {
  preferredProvider: LLMProvider;
  fallbackProvider: LLMProvider;
  autoSwitchOnOffline: boolean;
  useOnlineForComplexQueries: boolean;
  geminiApiKey?: string;
  selectedOnlineModel?: string;
  selectedOfflineModel?: string;
}
export interface NetworkStatus {
  isOnline: boolean;
  lastChecked: Date;
  latency?: number;
}
export interface StreamingResponse {
  id: string;
  content: string;
  isComplete: boolean;
  error?: string;
}
export interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  transcription: string;
  confidence: number;
  error?: string;
}
export interface AppSettings {
  systemInstructions: SystemInstructions;
  voiceConfig: VoiceConfig;
  streamingConfig: StreamingConfig;
  uiPreferences: {
    showPluginSidebar: boolean;
    showSystemStatus: boolean;
    compactMode: boolean;
  };
}
export interface PluginUIConfig {
  icon: string;
  color: string;
  position: number;
  showInSidebar: boolean;
  showInToolbar: boolean;
}
export interface EnhancedPluginManifest extends PluginManifest {
  ui: PluginUIConfig;
  dependencies?: string[];
  settings?: Record<string, any>;
}
export interface PluginState {
  enabled: boolean;
  data: Record<string, any>;
  lastUsed?: Date;
  usageCount: number;
}
export interface EnhancedPluginRegistry {
  [pluginName: string]: {
    plugin: Plugin;
    manifest: EnhancedPluginManifest;
    state: PluginState;
  };
}
export interface StreamingResponse {
  content: string;
  isComplete: boolean;
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: number;
  };
}
export interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  transcription: string;
  confidence: number;
  error?: string;
}
export interface EnhancedVoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  transcription: string;
  confidence: number;
  error?: string;
  micPermission: 'granted' | 'denied' | 'prompt';
}
export interface SystemInstructions {
  systemPrompt: string;
  promptTemplate: string;
  contextWindow?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  behaviorSettings?: {
    responseStyle: string;
    creativityLevel: number;
    useEmojis: boolean;
    includeThinking: boolean;
  };
  contextSettings?: {
    maxContextLength: number;
    includeSystemInfo: boolean;
    includeChatHistory: boolean;
  };
}
export interface VoiceConfig {
  sttEnabled: boolean;
  ttsEnabled: boolean;
  autoPlayTTS: boolean;
  voiceSpeed?: number;
  voiceVolume?: number;
  preferredVoice?: string;
  voiceProvider?: string;
  sttLanguage?: string;
  ttsVoice?: string;
}
export interface StreamingConfig {
  enabled: boolean;
  chunkSize: number;
  autoScroll: boolean;
  showTypingIndicator?: boolean;
  delayMs?: number;
}
