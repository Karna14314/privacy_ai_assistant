import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import {
  Message,
  ChatState,
  ChatActions,
  UserPreferences,
  PreferenceActions,
  AppState,
  SystemInfo,
  AppVersion,
  ChatSession,
  ChatSessionSummary,
  MultiChatState,
  ChatSessionActions,
  LLMRoutingPreferences,
  LLMProvider,
  PluginResult
} from '../types';
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const mockMessages: Message[] = [
  {
    id: generateId(),
    content: "Hello! I'm your privacy-first AI assistant. I run completely offline to protect your privacy.",
    role: 'assistant',
    timestamp: new Date(),
  },
  {
    id: generateId(),
    content: "How can I help you today?",
    role: 'user',
    timestamp: new Date(),
  },
];
const defaultPreferences: UserPreferences = {
  theme: 'system',
  sidebarCollapsed: false,
  fontSize: 'medium',
  enableNotifications: true,
  enableSounds: false,
  autoSave: true,
};
const defaultLLMPreferences: LLMRoutingPreferences = {
  preferredProvider: 'local',
  fallbackProvider: 'local',
  autoSwitchOnOffline: false,
  useOnlineForComplexQueries: false,
  geminiApiKey: '',
  selectedOnlineModel: 'gemma3n:latest',
  selectedOfflineModel: 'gemma3n:latest'
};
interface ChatStore extends ChatState, ChatActions {}
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: mockMessages,
      isLoading: false,
      error: null,
      currentInput: '',
      addMessage: (content: string, role: 'user' | 'assistant', customId?: string | number) => {
        const newMessage: Message = {
          id: customId ? customId.toString() : generateId(),
          content,
          role,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, newMessage]
        }));
      },
      updateMessage: (id: string, updates: Partial<Message>) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },
      deleteMessage: (id: string) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }));
      },
      clearMessages: () => {
        set({ messages: [] });
      },
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      setError: (error: string | null) => {
        set({ error });
      },
      setCurrentInput: (input: string) => {
        set({ currentInput: input });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        currentInput: state.currentInput,
      }),
    }
  )
);
interface AppStore extends AppState, PreferenceActions {
  setSystemInfo: (info: SystemInfo) => void;
  setAppVersion: (version: AppVersion) => void;
  setInitialized: (initialized: boolean) => void;
  llmPreferences: LLMRoutingPreferences;
  setLLMPreferences: (preferences: Partial<LLMRoutingPreferences>) => void;
  setPreferredProvider: (provider: LLMProvider) => void;
  toggleAutoSwitchOnOffline: () => void;
  toggleUseOnlineForComplexQueries: () => void;
  pluginsEnabled: boolean;
  setPluginsEnabled: (enabled: boolean) => void;
}
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      isInitialized: false,
      systemInfo: null,
      appVersion: null,
      preferences: defaultPreferences,
      llmPreferences: defaultLLMPreferences,
      pluginsEnabled: true,
      setSystemInfo: (info: SystemInfo) => {
        set({ systemInfo: info });
      },
      setAppVersion: (version: AppVersion) => {
        set({ appVersion: version });
      },
      setInitialized: (initialized: boolean) => {
        set({ isInitialized: initialized });
      },
      setTheme: (theme) => {
        set((state) => ({
          preferences: { ...state.preferences, theme },
        }));
      },
      setSidebarCollapsed: (collapsed) => {
        set((state) => ({
          preferences: { ...state.preferences, sidebarCollapsed: collapsed },
        }));
      },
      setFontSize: (fontSize) => {
        set((state) => ({
          preferences: { ...state.preferences, fontSize },
        }));
      },
      toggleNotifications: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            enableNotifications: !state.preferences.enableNotifications,
          },
        }));
      },
      toggleSounds: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            enableSounds: !state.preferences.enableSounds,
          },
        }));
      },
      toggleAutoSave: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            autoSave: !state.preferences.autoSave,
          },
        }));
      },
      resetPreferences: () => {
        set({ preferences: defaultPreferences });
      },
      setLLMPreferences: (preferences: Partial<LLMRoutingPreferences>) => {
        set((state) => ({
          llmPreferences: { ...state.llmPreferences, ...preferences }
        }));
      },
      setPreferredProvider: (provider: LLMProvider) => {
        set((state) => ({
          llmPreferences: { ...state.llmPreferences, preferredProvider: provider }
        }));
      },
      toggleAutoSwitchOnOffline: () => {
        set((state) => ({
          llmPreferences: {
            ...state.llmPreferences,
            autoSwitchOnOffline: !state.llmPreferences.autoSwitchOnOffline
          }
        }));
      },
      toggleUseOnlineForComplexQueries: () => {
        set((state) => ({
          llmPreferences: {
            ...state.llmPreferences,
            useOnlineForComplexQueries: !state.llmPreferences.useOnlineForComplexQueries
          }
        }));
      },
      setPluginsEnabled: (enabled: boolean) => {
        set({ pluginsEnabled: enabled });
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        preferences: state.preferences,
        llmPreferences: state.llmPreferences,
        pluginsEnabled: state.pluginsEnabled,
      }),
    }
  )
);
interface MultiChatStore extends MultiChatState, ChatActions, ChatSessionActions {
  executePlugin: (input: string) => Promise<PluginResult | null>;
  generateLLMResponse: (prompt: string, forceProvider?: LLMProvider) => Promise<string>;
}
export const useMultiChatStore = create<MultiChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      error: null,
      currentInput: '',
      activeChatId: null,
      chatSessions: {},
      chatSummaries: [],
      addMessage: (content: string, role: 'user' | 'assistant', customId?: string | number) => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) {
          console.warn('❌ No active chat session for adding message');
          return;
        }
        const newMessage: Message = {
          id: customId ? customId.toString() : generateId(),
          content,
          role,
          timestamp: new Date(),
        };
        console.log(` Adding ${role} message to chat ${activeChatId}: ${content.substring(0, 50)}...`);
        set((state) => {
          const currentSession = state.chatSessions[activeChatId];
          if (!currentSession) {
            console.error(`❌ Chat session ${activeChatId} not found when adding message`);
            return state;
          }
          const updatedSession = {
            ...currentSession,
            messages: [...currentSession.messages, newMessage],
            updatedAt: new Date(),
            metadata: {
              ...currentSession.metadata,
              messageCount: currentSession.messages.length + 1,
              lastActivity: new Date()
            }
          };
          console.log(`✅ Updated session ${activeChatId} with ${updatedSession.messages.length} messages`);
          return {
            messages: [...state.messages, newMessage],
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            }
          };
        });
        get().saveMessageToBackend(activeChatId, content, role);
      },
      saveMessageToBackend: async (chatId: string, content: string, role: 'user' | 'assistant') => {
        try {
          const session = get().chatSessions[chatId];
          const model = session?.metadata?.model || 'gemma3n:latest';
          await invoke('add_message_to_chat', {
            chatId,
            content,
            role,
            model
          });
        } catch (error) {
          console.error('Failed to save message to backend:', error);
        }
      },
      updateMessage: (id: string, updates: Partial<Message>) => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) return;
        set((state) => {
          const updatedMessages = state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          );
          const updatedSession = state.chatSessions[activeChatId];
          if (updatedSession) {
            updatedSession.messages = updatedMessages;
            updatedSession.updatedAt = new Date();
          }
          return {
            messages: updatedMessages,
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            }
          };
        });
        get().saveChatSession(activeChatId);
      },
      deleteMessage: (id: string) => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) return;
        set((state) => {
          const updatedMessages = state.messages.filter((msg) => msg.id !== id);
          const updatedSession = state.chatSessions[activeChatId];
          if (updatedSession) {
            updatedSession.messages = updatedMessages;
            updatedSession.updatedAt = new Date();
          }
          return {
            messages: updatedMessages,
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            }
          };
        });
        get().saveChatSession(activeChatId);
      },
      clearMessages: () => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) return;
        set((state) => {
          const updatedSession = state.chatSessions[activeChatId];
          if (updatedSession) {
            updatedSession.messages = [];
            updatedSession.updatedAt = new Date();
          }
          return {
            messages: [],
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            }
          };
        });
        get().saveChatSession(activeChatId);
      },
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      setError: (error: string | null) => {
        set({ error });
      },
      setCurrentInput: (input: string) => {
        set({ currentInput: input });
      },
      createNewChat: async (title?: string): Promise<string> => {
        try {
          try {
            const response = await invoke<{chat_id: string, title: string, success: boolean, error?: string}>('create_chat_session', {
              title: title || undefined
            });
            if (response.success) {
              const newSession: ChatSession = {
                id: response.chat_id,
                title: response.title,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                  model: 'gemma3n:latest',
                  tokenCount: 0,
                  messageCount: 0,
                  lastActivity: new Date(),
                  tags: [],
                  isArchived: false
                }
              };
              set((state) => ({
                chatSessions: {
                  ...state.chatSessions,
                  [response.chat_id]: newSession
                },
                activeChatId: response.chat_id,
                messages: [],
                currentInput: ''
              }));
              await get().loadChatSessions();
              return response.chat_id;
            } else {
              throw new Error(response.error || 'Backend failed to create chat session');
            }
          } catch (backendError) {
            console.warn('Backend unavailable, using local fallback:', backendError);
            const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const chatTitle = title || `New Chat ${new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}`;
            const newSession: ChatSession = {
              id: chatId,
              title: chatTitle,
              messages: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                model: 'gemma3n:latest',
                tokenCount: 0,
                messageCount: 0,
                lastActivity: new Date(),
                tags: [],
                isArchived: false
              }
            };
            set((state) => ({
              chatSessions: {
                ...state.chatSessions,
                [chatId]: newSession
              },
              activeChatId: chatId,
              messages: [],
              currentInput: '',
              chatSummaries: [
                {
                  id: chatId,
                  title: chatTitle,
                  lastMessage: null,
                  messageCount: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  lastActivity: new Date()
                },
                ...state.chatSummaries
              ]
            }));
            console.log(`✅ Created local chat session: ${chatId}`);
            return chatId;
          }
        } catch (error) {
          console.error('Failed to create new chat:', error);
          set({ error: `Failed to create new chat: ${error}` });
          throw error;
        }
      },
      switchToChat: async (chatId: string): Promise<void> => {
        try {
          console.log(` Switching to chat: ${chatId}`);
          let session = get().chatSessions[chatId];
          if (session) {
            console.log(`✅ Found session in memory with ${session.messages.length} messages`);
          } else {
            console.log(` Session not in memory, attempting to load from backend...`);
            try {
              const response = await invoke<{session: ChatSession | null, success: boolean, error?: string}>('get_chat_session', {
                chatId
              });
              if (response.success && response.session) {
                console.log(`✅ Loaded session from backend with ${response.session.messages.length} messages`);
                session = {
                  ...response.session,
                  createdAt: new Date(response.session.createdAt),
                  updatedAt: new Date(response.session.updatedAt),
                  messages: response.session.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  }))
                };
                set((state) => ({
                  chatSessions: {
                    ...state.chatSessions,
                    [chatId]: session!
                  }
                }));
              } else {
                throw new Error(response.error || 'Chat session not found in backend');
              }
            } catch (backendError) {
              console.warn('⚠️ Backend unavailable for chat loading, checking local data:', backendError);
              const summary = get().chatSummaries.find(s => s.id === chatId);
              if (summary) {
                console.log(`⚠️ Creating empty session from summary for chat: ${summary.title}`);
                session = {
                  id: chatId,
                  title: summary.title,
                  messages: [],
                  createdAt: summary.createdAt,
                  updatedAt: summary.updatedAt,
                  metadata: {
                    model: 'gemma3n:latest',
                    tokenCount: 0,
                    messageCount: 0,
                    lastActivity: summary.updatedAt,
                    tags: [],
                    isArchived: false
                  }
                };
                set((state) => ({
                  chatSessions: {
                    ...state.chatSessions,
                    [chatId]: session!
                  }
                }));
                console.log(`⚠️ Created empty session for ${chatId} - messages may be lost`);
              } else {
                const error = 'Chat session not found locally or in backend';
                console.error(`❌ ${error}`);
                throw new Error(error);
              }
            }
          }
          set({
            activeChatId: chatId,
            messages: session.messages,
            currentInput: ''
          });
          console.log(`✅ Switched to chat session: ${chatId}`);
        } catch (error) {
          console.error('Failed to switch to chat:', error);
          set({ error: `Failed to switch to chat: ${error}` });
          throw error;
        }
      },
      renameChat: async (chatId: string, newTitle: string): Promise<void> => {
        try {
          const response = await invoke<{success: boolean, error?: string}>('rename_chat_session', {
            chatId,
            newTitle
          });
          if (response.success) {
            set((state) => {
              const updatedSession = state.chatSessions[chatId];
              if (updatedSession) {
                updatedSession.title = newTitle;
                updatedSession.updatedAt = new Date();
              }
              return {
                chatSessions: {
                  ...state.chatSessions,
                  [chatId]: updatedSession
                }
              };
            });
            await get().loadChatSessions();
          } else {
            throw new Error(response.error || 'Failed to rename chat');
          }
        } catch (error) {
          console.error('Failed to rename chat:', error);
          set({ error: `Failed to rename chat: ${error}` });
          throw error;
        }
      },
      deleteChat: async (chatId: string): Promise<void> => {
        try {
          const response = await invoke<{success: boolean, error?: string}>('delete_chat_session', {
            chatId
          });
          if (response.success) {
            set((state) => {
              const { [chatId]: deleted, ...remainingSessions } = state.chatSessions;
              const newActiveChatId = state.activeChatId === chatId ? null : state.activeChatId;
              return {
                chatSessions: remainingSessions,
                activeChatId: newActiveChatId,
                messages: newActiveChatId ? state.messages : [],
                chatSummaries: state.chatSummaries.filter(s => s.id !== chatId)
              };
            });
            if (get().activeChatId === null) {
              set({ messages: [] });
            }
          } else {
            throw new Error(response.error || 'Failed to delete chat');
          }
        } catch (error) {
          console.error('Failed to delete chat:', error);
          set({ error: `Failed to delete chat: ${error}` });
          throw error;
        }
      },
      archiveChat: async (chatId: string): Promise<void> => {
        try {
          console.log('Archive chat not yet implemented:', chatId);
        } catch (error) {
          console.error('Failed to archive chat:', error);
          throw error;
        }
      },
      loadChatSessions: async (): Promise<void> => {
        try {
          console.log(' Loading chat sessions...');
          const state = get();
          const existingLocalSessions = Object.keys(state.chatSessions).length;
          console.log(` Found ${existingLocalSessions} persisted chat sessions`);
          try {
            const response = await invoke<{sessions: ChatSessionSummary[], success: boolean, error?: string}>('list_chat_sessions');
            if (response.success) {
              const backendSummaries = response.sessions.map(summary => ({
                ...summary,
                lastActivity: summary.lastActivity ? new Date(summary.lastActivity) : new Date(),
                createdAt: summary.createdAt ? new Date(summary.createdAt) : new Date(),
                updatedAt: summary.updatedAt ? new Date(summary.updatedAt) : new Date()
              }));
              const localSummaries = Object.values(state.chatSessions).map(session => ({
                id: session.id,
                title: session.title,
                lastMessage: session.messages.length > 0
                  ? session.messages[session.messages.length - 1].content.substring(0, 100)
                  : null,
                messageCount: session.messages.length,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                lastActivity: session.metadata?.lastActivity || session.updatedAt
              }));
              const backendIds = new Set(backendSummaries.map(s => s.id));
              const localOnlySummaries = localSummaries.filter(s => !backendIds.has(s.id));
              const combinedSummaries = [...backendSummaries, ...localOnlySummaries];
              combinedSummaries.sort((a, b) =>
                new Date(b.lastActivity || b.updatedAt).getTime() -
                new Date(a.lastActivity || a.updatedAt).getTime()
              );
              set({ chatSummaries: combinedSummaries });
              console.log(`✅ Loaded ${backendSummaries.length} backend + ${localOnlySummaries.length} local chat sessions`);
              return;
            } else {
              throw new Error(response.error || 'Backend failed to load chat sessions');
            }
          } catch (backendError) {
            console.warn('Backend unavailable, using local chat sessions:', backendError);
            const localSummaries = Object.values(state.chatSessions).map(session => ({
              id: session.id,
              title: session.title,
              lastMessage: session.messages.length > 0
                ? session.messages[session.messages.length - 1].content.substring(0, 100)
                : null,
              messageCount: session.messages.length,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
              lastActivity: session.metadata?.lastActivity || session.updatedAt
            }));
            localSummaries.sort((a, b) =>
              new Date(b.lastActivity || b.updatedAt).getTime() -
              new Date(a.lastActivity || a.updatedAt).getTime()
            );
            set({ chatSummaries: localSummaries });
            console.log(`✅ Loaded ${localSummaries.length} local chat sessions from persistence`);
          }
        } catch (error) {
          console.error('Failed to load chat sessions:', error);
          set({ error: `Failed to load chat sessions: ${error}` });
        }
      },
      saveChatSession: async (chatId: string): Promise<void> => {
        try {
          const session = get().chatSessions[chatId];
          if (!session) return;
          console.log('Session auto-saved:', chatId);
        } catch (error) {
          console.error('Failed to save chat session:', error);
        }
      },
      duplicateChat: async (chatId: string): Promise<string> => {
        try {
          const session = get().chatSessions[chatId];
          if (!session) {
            throw new Error('Chat session not found');
          }
          const newChatId = await get().createNewChat(`${session.title} (Copy)`);
          for (const message of session.messages) {
            await invoke('add_message_to_chat', {
              chatId: newChatId,
              content: message.content,
              role: message.role,
              model: session.metadata?.model || 'gemma3n:latest'
            });
          }
          return newChatId;
        } catch (error) {
          console.error('Failed to duplicate chat:', error);
          throw error;
        }
      },
      generateContextAwareResponse: async (prompt: string, systemPrompt?: string): Promise<string> => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) {
          throw new Error('No active chat session');
        }
        try {
          get().addMessage(prompt, 'user');
          const session = state.chatSessions[activeChatId];
          const model = session?.metadata?.model || 'gemma3n:latest';
          const response = await invoke<{response: string, success: boolean, error?: string}>('generate_chat_llm_response', {
            chatId: activeChatId,
            prompt,
            model,
            systemPrompt,
            stream: false
          });
          if (response.success) {
            await get().switchToChat(activeChatId);
            return response.response;
          } else {
            throw new Error(response.error || 'Failed to generate response');
          }
        } catch (error) {
          console.error('Failed to generate context-aware response:', error);
          throw error;
        }
      },
      executePlugin: async (input: string): Promise<PluginResult | null> => {
        try {
          const { pluginRunner } = await import('../core/agents/pluginRunner');
          await pluginRunner.initialize();
          const result = await pluginRunner.processInput(input, {
            chatId: get().activeChatId || undefined,
            timestamp: new Date()
          });
          if (result.shouldExecutePlugin && result.pluginResult) {
            return {
              success: result.pluginResult.success,
              data: result.pluginResult.data,
              message: result.pluginResult.message,
              error: result.pluginResult.error
            };
          }
          return null;
        } catch (error) {
          console.error('Plugin execution failed:', error);
          return {
            success: false,
            error: `Plugin execution failed: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      },
      generateLLMResponse: async (prompt: string, forceProvider?: LLMProvider): Promise<string> => {
        try {
          const { llmRouter } = await import('../core/agents/llmRouter');
          const appStore = useAppStore.getState();
          llmRouter.updatePreferences(appStore.llmPreferences);
          const response = await llmRouter.routeRequest(prompt, undefined, forceProvider);
          if (response.success && response.response) {
            return response.response;
          } else {
            throw new Error(response.error || 'LLM request failed');
          }
        } catch (error) {
          console.error('LLM routing failed:', error);
          throw error;
        }
      }
    }),
    {
      name: 'multi-chat-storage',
      partialize: (state) => ({
        activeChatId: state.activeChatId,
        chatSessions: state.chatSessions,
        chatSummaries: state.chatSummaries,
        currentInput: state.currentInput,
      }),
    }
  )
);
