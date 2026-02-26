import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import {
  Message,
  ChatSession,
  ChatSessionSummary,
  MultiChatState,
  ChatActions,
  ChatSessionActions,
  LLMProvider,
  PluginResult
} from '../types';
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
let chatStore: Store | null = null;
const initChatStore = async () => {
  if (!chatStore) {
    try {
      chatStore = await Store.load('chats.json');
    } catch (error) {
      console.warn('Failed to initialize chat store, using localStorage fallback:', error);
    }
  }
  return chatStore;
};
interface EnhancedChatState extends MultiChatState {
  isInitialized: boolean;
  lastSyncTime: Date | null;
  tokenCount: number;
  maxTokens: number;
  isOptimizing: boolean;
  lastOptimization: Date | null;
}
interface EnhancedChatActions extends ChatActions, ChatSessionActions {
  initializeStore: () => Promise<void>;
  syncWithTauriStore: () => Promise<void>;
  createNewChatWithTitle: (title: string) => Promise<string>;
  bulkImportChats: (chats: ChatSession[]) => Promise<void>;
  searchChats: (query: string) => ChatSessionSummary[];
  getRecentChats: (limit?: number) => ChatSessionSummary[];
  addMessageWithMetadata: (
    content: string,
    role: 'user' | 'assistant',
    metadata?: { model?: string; provider?: LLMProvider; tokens?: number }
  ) => void;
  addMessageDirect: (message: Message) => void;
  executePluginWithContext: (input: string, context?: any) => Promise<PluginResult | null>;
  exportAllChats: () => Promise<string>;
  importChatsFromJson: (jsonData: string) => Promise<void>;
  calculateTokenUsage: (messages?: Message[]) => number;
  pruneOldMessages: () => Promise<void>;
  clearAllContext: () => void;
  updateTokenCount: () => void;
}
interface EnhancedChatStore extends EnhancedChatState, EnhancedChatActions {}
export const useEnhancedChatStore = create<EnhancedChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      error: null,
      currentInput: '',
      activeChatId: null,
      chatSessions: {},
      chatSummaries: [],
      isInitialized: false,
      lastSyncTime: null,
      tokenCount: 0,
      maxTokens: 32768,
      isOptimizing: false,
      lastOptimization: null,
      initializeStore: async () => {
        try {
          console.log(' Initializing enhanced chat store...');
          const store = await initChatStore();
          if (store) {
            const savedChats = await store.get<Record<string, ChatSession>>('chat-sessions');
            const savedSummaries = await store.get<ChatSessionSummary[]>('chat-summaries');
            if (savedChats) {
              set({ chatSessions: savedChats });
            }
            if (savedSummaries) {
              set({ chatSummaries: savedSummaries });
            }
          }
          await get().loadChatSessions();
          set({ 
            isInitialized: true, 
            lastSyncTime: new Date() 
          });
          console.log('✅ Enhanced chat store initialized');
        } catch (error) {
          console.error('❌ Failed to initialize chat store:', error);
          set({
            error: `Failed to initialize: ${error}`,
            isInitialized: true
          });
        }
      },
      syncWithTauriStore: async () => {
        try {
          const store = await initChatStore();
          if (store) {
            const state = get();
            await store.set('chat-sessions', state.chatSessions);
            await store.set('chat-summaries', state.chatSummaries);
            await store.save();
            set({ lastSyncTime: new Date() });
          }
        } catch (error) {
          console.error('Failed to sync with Tauri store:', error);
        }
      },
      createNewChatWithTitle: async (title: string): Promise<string> => {
        const chatId = `chat_${generateId()}`;
        const now = new Date();
        const newSession: ChatSession = {
          id: chatId,
          title,
          messages: [],
          createdAt: now,
          updatedAt: now,
          metadata: {
            model: 'gemma3n:latest',
            tokenCount: 0,
            messageCount: 0,
            lastActivity: now,
            tags: [],
            isArchived: false
          }
        };
        const newSummary: ChatSessionSummary = {
          id: chatId,
          title,
          lastMessage: null,
          messageCount: 0,
          createdAt: now,
          updatedAt: now,
          lastActivity: now
        };
        set((state) => ({
          chatSessions: {
            ...state.chatSessions,
            [chatId]: newSession
          },
          chatSummaries: [newSummary, ...state.chatSummaries],
          activeChatId: chatId,
          messages: []
        }));
        await get().syncWithTauriStore();
        try {
          await invoke('create_chat_session', { title });
        } catch (error) {
          console.warn('Backend unavailable for chat creation:', error);
        }
        return chatId;
      },
      searchChats: (query: string): ChatSessionSummary[] => {
        const state = get();
        const lowercaseQuery = query.toLowerCase();
        return state.chatSummaries.filter(summary => 
          summary.title.toLowerCase().includes(lowercaseQuery) ||
          (summary.lastMessage && summary.lastMessage.toLowerCase().includes(lowercaseQuery))
        );
      },
      getRecentChats: (limit = 10): ChatSessionSummary[] => {
        const state = get();
        return state.chatSummaries
          .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
          .slice(0, limit);
      },
      addMessageWithMetadata: (
        content: string, 
        role: 'user' | 'assistant', 
        metadata?: { model?: string; provider?: LLMProvider; tokens?: number }
      ) => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) {
          console.warn('❌ No active chat session for adding message');
          return;
        }
        const newMessage: Message = {
          id: generateId(),
          content,
          role,
          timestamp: new Date(),
        };
        set((state) => {
          const currentSession = state.chatSessions[activeChatId];
          if (!currentSession) {
            return state;
          }
          const updatedSession = {
            ...currentSession,
            messages: [...currentSession.messages, newMessage],
            updatedAt: new Date(),
            metadata: {
              ...currentSession.metadata,
              messageCount: currentSession.messages.length + 1,
              lastActivity: new Date(),
              model: metadata?.model || currentSession.metadata?.model,
              tokenCount: (currentSession.metadata?.tokenCount || 0) + (metadata?.tokens || 0)
            }
          };
          const updatedSummaries = state.chatSummaries.map(summary =>
            summary.id === activeChatId
              ? {
                  ...summary,
                  lastMessage: content.substring(0, 100),
                  messageCount: updatedSession.messages.length,
                  updatedAt: new Date(),
                  lastActivity: new Date()
                }
              : summary
          );
          return {
            messages: [...state.messages, newMessage],
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            },
            chatSummaries: updatedSummaries
          };
        });
        setTimeout(() => get().syncWithTauriStore(), 1000);
      },
      exportAllChats: async (): Promise<string> => {
        const state = get();
        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          chatSessions: state.chatSessions,
          chatSummaries: state.chatSummaries,
          totalChats: state.chatSummaries.length,
          totalMessages: Object.values(state.chatSessions).reduce(
            (total, session) => total + session.messages.length, 
            0
          )
        };
        return JSON.stringify(exportData, null, 2);
      },
      importChatsFromJson: async (jsonData: string): Promise<void> => {
        try {
          const importData = JSON.parse(jsonData);
          if (!importData.chatSessions || !importData.chatSummaries) {
            throw new Error('Invalid chat export format');
          }
          set((state) => ({
            chatSessions: {
              ...state.chatSessions,
              ...importData.chatSessions
            },
            chatSummaries: [
              ...importData.chatSummaries,
              ...state.chatSummaries
            ]
          }));
          await get().syncWithTauriStore();
        } catch (error) {
          console.error('Failed to import chats:', error);
          throw error;
        }
      },
      addMessage: (content: string, role: 'user' | 'assistant') => {
        get().addMessageWithMetadata(content, role);
      },
      updateMessage: (id: string, updates: Partial<Message>) => {
        console.log(` [ENHANCED STORE] Updating message ${id} with:`, updates);
        set((state) => {
          const updatedMessages = state.messages.map(msg => {
            if (msg.id === id) {
              const updatedMessage = {
                ...msg,
                ...updates,
                timestamp: updates.timestamp || msg.timestamp,
                metadata: updates.metadata ? { ...msg.metadata, ...updates.metadata } : msg.metadata
              };
              console.log(`✅ [ENHANCED STORE] Updated message ${id}:`, {
                oldContent: msg.content?.substring(0, 50) + '...',
                newContent: updatedMessage.content?.substring(0, 50) + '...',
                role: updatedMessage.role
              });
              return updatedMessage;
            }
            return msg;
          });
          const { activeChatId, chatSessions } = state;
          let updatedChatSessions = state.chatSessions;
          if (activeChatId && chatSessions[activeChatId]) {
            const currentSession = chatSessions[activeChatId];
            const updatedSessionMessages = currentSession.messages.map(msg => {
              if (msg.id === id) {
                const updatedMessage = {
                  ...msg,
                  ...updates,
                  timestamp: updates.timestamp || msg.timestamp,
                  metadata: updates.metadata ? { ...msg.metadata, ...updates.metadata } : msg.metadata
                };
                console.log(`✅ [ENHANCED STORE] Updated session message ${id}:`, {
                  oldContent: msg.content?.substring(0, 50) + '...',
                  newContent: updatedMessage.content?.substring(0, 50) + '...',
                  role: updatedMessage.role
                });
                return updatedMessage;
              }
              return msg;
            });
            const updatedSession = {
              ...currentSession,
              messages: updatedSessionMessages,
              updatedAt: new Date(),
              metadata: {
                ...currentSession.metadata,
                lastActivity: new Date()
              }
            };
            updatedChatSessions = {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            };
          }
          console.log(`✅ [ENHANCED STORE] Successfully updated message ${id} in both arrays`);
          return {
            messages: updatedMessages,
            chatSessions: updatedChatSessions
          };
        });
        try {
          const { activeChatId, chatSessions } = get();
          if (activeChatId && chatSessions[activeChatId]) {
            get().saveChatSession(activeChatId, chatSessions[activeChatId]);
          }
        } catch (error) {
          console.error('❌ [ENHANCED STORE] Failed to save updated message:', error);
        }
      },
      addMessageDirect: (message: Message) => {
        const state = get();
        const activeChatId = state.activeChatId;
        console.log(` [ENHANCED STORE] Adding message directly:`, {
          id: message.id,
          role: message.role,
          contentLength: message.content.length,
          activeChatId
        });
        const messageExists = state.messages.some(msg => msg.id === message.id);
        if (messageExists) {
          console.log(`⚠️ [ENHANCED STORE] Message ${message.id} already exists, skipping`);
          return;
        }
        set((state) => {
          const updatedMessages = [...state.messages, message];
          let updatedChatSessions = state.chatSessions;
          if (activeChatId && state.chatSessions[activeChatId]) {
            const currentSession = state.chatSessions[activeChatId];
            const sessionMessageExists = currentSession.messages.some(msg => msg.id === message.id);
            if (!sessionMessageExists) {
              const updatedSession = {
                ...currentSession,
                messages: [...currentSession.messages, message],
                updatedAt: new Date(),
                metadata: {
                  ...currentSession.metadata,
                  messageCount: currentSession.messages.length + 1,
                  lastActivity: new Date()
                }
              };
              updatedChatSessions = {
                ...state.chatSessions,
                [activeChatId]: updatedSession
              };
              console.log(`✅ [ENHANCED STORE] Added message ${message.id} to session ${activeChatId}`);
            } else {
              console.log(`⚠️ [ENHANCED STORE] Message ${message.id} already exists in session, skipping`);
            }
          }
          console.log(`✅ [ENHANCED STORE] Added message ${message.id} to messages array`);
          return {
            messages: updatedMessages,
            chatSessions: updatedChatSessions
          };
        });
        if (activeChatId && state.chatSessions[activeChatId]) {
          get().saveChatSession(activeChatId, state.chatSessions[activeChatId]);
        }
      },
      deleteMessage: (id: string) => {
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
      createNewChat: async (title?: string): Promise<string> => {
        return get().createNewChatWithTitle(title || `New Chat ${new Date().toLocaleString()}`);
      },
      switchToChat: async (chatId: string): Promise<void> => {
        const state = get();
        const session = state.chatSessions[chatId];
        if (!session) {
          console.error('Chat session not found:', chatId);
          return;
        }
        set({
          activeChatId: chatId,
          messages: session.messages || []
        });
        console.log('Switched to chat:', chatId, 'with', session.messages?.length || 0, 'messages');
      },
      renameChat: async (chatId: string, newTitle: string): Promise<void> => {
        const state = get();
        const session = state.chatSessions[chatId];
        if (!session) {
          console.error('Chat session not found:', chatId);
          return;
        }
        const updatedSession = {
          ...session,
          title: newTitle.trim(),
          updatedAt: new Date()
        };
        set((state) => ({
          chatSessions: {
            ...state.chatSessions,
            [chatId]: updatedSession
          }
        }));
        set((state) => ({
          chatSummaries: state.chatSummaries.map(summary =>
            summary.id === chatId
              ? { ...summary, title: newTitle.trim(), updatedAt: new Date() }
              : summary
          )
        }));
        get().saveChatSession(chatId, updatedSession);
        console.log('Renamed chat:', chatId, 'to:', newTitle);
      },
      deleteChat: async (chatId: string): Promise<void> => {
        const state = get();
        if (!state.chatSessions[chatId]) {
          console.error('Chat session not found:', chatId);
          return;
        }
        const { [chatId]: deletedSession, ...remainingSessions } = state.chatSessions;
        set({
          chatSessions: remainingSessions,
          chatSummaries: state.chatSummaries.filter(summary => summary.id !== chatId),
          activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
          messages: state.activeChatId === chatId ? [] : state.messages
        });
        try {
          const store = await initChatStore();
          if (store) {
            await store.delete(`chat-${chatId}`);
          }
        } catch (error) {
          console.warn('Failed to delete from persistent storage:', error);
        }
        console.log('Deleted chat:', chatId);
      },
      archiveChat: async (chatId: string): Promise<void> => {
        const state = get();
        const session = state.chatSessions[chatId];
        if (!session) {
          console.error('Chat session not found:', chatId);
          return;
        }
        const archivedSession = {
          ...session,
          metadata: {
            ...session.metadata,
            archived: true,
            archivedAt: new Date()
          },
          updatedAt: new Date()
        };
        set((state) => ({
          chatSessions: {
            ...state.chatSessions,
            [chatId]: archivedSession
          }
        }));
        set((state) => ({
          chatSummaries: state.chatSummaries.map(summary =>
            summary.id === chatId
              ? {
                  ...summary,
                  metadata: { ...summary.metadata, archived: true },
                  updatedAt: new Date()
                }
              : summary
          )
        }));
        get().saveChatSession(chatId, archivedSession);
        console.log('Archived chat:', chatId);
      },
      loadChatSessions: async (): Promise<void> => {
      },
      saveChatSession: async (chatId: string, session?: ChatSession): Promise<void> => {
        try {
          const state = get();
          const sessionToSave = session || state.chatSessions[chatId];
          if (!sessionToSave) {
            console.warn(`No session found to save for chatId: ${chatId}`);
            return;
          }
          if (session) {
            set((state) => ({
              chatSessions: {
                ...state.chatSessions,
                [chatId]: session
              }
            }));
          }
          await get().syncWithTauriStore();
          try {
            await invoke('save_chat_session', {
              chatId,
              session: sessionToSave
            });
          } catch (error) {
            console.warn('Backend unavailable for saving session:', error);
          }
        } catch (error) {
          console.error('Failed to save chat session:', error);
        }
      },
      duplicateChat: async (chatId: string): Promise<string> => {
        return '';
      },
      generateContextAwareResponse: async (prompt: string, systemPrompt?: string): Promise<string> => {
        return '';
      },
      saveMessageToBackend: async (chatId: string, content: string, role: 'user' | 'assistant'): Promise<void> => {
      },
      executePluginWithContext: async (input: string, context?: any): Promise<PluginResult | null> => {
        return null;
      },
      bulkImportChats: async (chats: ChatSession[]): Promise<void> => {
      },
      calculateTokenUsage: (messages?: Message[]): number => {
        const state = get();
        const messagesToCount = messages || state.messages;
        if (!messagesToCount || messagesToCount.length === 0) {
          return 0;
        }
        let totalTokens = 0;
        messagesToCount.forEach(message => {
          totalTokens += Math.ceil(message.content.length / 4);
          totalTokens += 10;
        });
        const systemInstructionsTokens = 100;
        const contextOverheadTokens = 50;
        totalTokens += systemInstructionsTokens + contextOverheadTokens;
        return totalTokens;
      },
      updateTokenCount: (): void => {
        const state = get();
        const newTokenCount = state.calculateTokenUsage();
        set({ tokenCount: newTokenCount });
        if (newTokenCount >= state.maxTokens * 0.9) {
          console.log(' [Context] Auto-pruning triggered at 90% capacity');
          state.pruneOldMessages();
        }
      },
      pruneOldMessages: async (): Promise<void> => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId || state.isOptimizing) {
          return;
        }
        set({ isOptimizing: true });
        try {
          console.log(' [Context] Starting message pruning...');
          const currentSession = state.chatSessions[activeChatId];
          if (!currentSession || !currentSession.messages) {
            return;
          }
          const messages = [...currentSession.messages];
          const totalMessages = messages.length;
          if (totalMessages <= 10) {
            return;
          }
          const systemMessages = messages.filter(msg => msg.role === 'system');
          const recentMessages = messages.slice(-10);
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          const currentThreadMessages = messages.filter(msg =>
            new Date(msg.timestamp) > thirtyMinutesAgo
          );
          const preservedMessageIds = new Set();
          const preservedMessages: Message[] = [];
          systemMessages.forEach(msg => {
            if (!preservedMessageIds.has(msg.id)) {
              preservedMessages.push(msg);
              preservedMessageIds.add(msg.id);
            }
          });
          recentMessages.forEach(msg => {
            if (!preservedMessageIds.has(msg.id)) {
              preservedMessages.push(msg);
              preservedMessageIds.add(msg.id);
            }
          });
          currentThreadMessages.forEach(msg => {
            if (!preservedMessageIds.has(msg.id)) {
              preservedMessages.push(msg);
              preservedMessageIds.add(msg.id);
            }
          });
          preservedMessages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const prunedCount = totalMessages - preservedMessages.length;
          const updatedSession = {
            ...currentSession,
            messages: preservedMessages,
            lastActivity: new Date()
          };
          set({
            chatSessions: {
              ...state.chatSessions,
              [activeChatId]: updatedSession
            },
            messages: preservedMessages,
            lastOptimization: new Date()
          });
          const newTokenCount = state.calculateTokenUsage(preservedMessages);
          set({ tokenCount: newTokenCount });
          console.log(`✅ [Context] Pruned ${prunedCount} messages, kept ${preservedMessages.length}`);
          console.log(` [Context] Token count reduced to ${newTokenCount}`);
        } catch (error) {
          console.error('❌ [Context] Failed to prune messages:', error);
        } finally {
          set({ isOptimizing: false });
        }
      },
      clearAllContext: (): void => {
        const state = get();
        const activeChatId = state.activeChatId;
        if (!activeChatId) {
          return;
        }
        console.log('️ [Context] Clearing all context...');
        const updatedSession = {
          ...state.chatSessions[activeChatId],
          messages: [],
          lastActivity: new Date()
        };
        set({
          chatSessions: {
            ...state.chatSessions,
            [activeChatId]: updatedSession
          },
          messages: [],
          tokenCount: 0,
          lastOptimization: new Date()
        });
        console.log('✅ [Context] All context cleared');
      }
    }),
    {
      name: 'enhanced-chat-storage',
      partialize: (state) => ({
        activeChatId: state.activeChatId,
        chatSessions: state.chatSessions,
        chatSummaries: state.chatSummaries,
        currentInput: state.currentInput,
        tokenCount: state.tokenCount,
        lastOptimization: state.lastOptimization,
      }),
    }
  )
);
