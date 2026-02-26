import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Store } from '@tauri-apps/plugin-store';
import { AppSettings, SystemInstructions, VoiceConfig, StreamingConfig } from '../types';
const defaultSystemInstructions: SystemInstructions = {
  systemPrompt: `You are a helpful, privacy-focused AI assistant. You run locally to protect user privacy. 
Be concise but informative, and always prioritize user privacy and security.`,
  promptTemplate: `{system_prompt}
User: {user_message}
Assistant:`,
  behaviorSettings: {
    responseStyle: 'conversational',
    creativityLevel: 0.7,
    useEmojis: true,
    includeThinking: false,
  },
  contextSettings: {
    maxContextLength: 4000,
    includeSystemInfo: false,
    includeChatHistory: true,
  },
};
const defaultVoiceConfig: VoiceConfig = {
  sttEnabled: true,
  ttsEnabled: true,
  voiceProvider: 'web-speech',
  sttLanguage: 'en-US',
  autoPlayTTS: false,
};
const defaultStreamingConfig: StreamingConfig = {
  enabled: true,
  chunkSize: 50,
  delayMs: 50,
  autoScroll: true,
};
const defaultAppSettings: AppSettings = {
  systemInstructions: defaultSystemInstructions,
  voiceConfig: defaultVoiceConfig,
  streamingConfig: defaultStreamingConfig,
  uiPreferences: {
    showPluginSidebar: true,
    showSystemStatus: true,
    compactMode: false,
  },
};
interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
}
interface SettingsActions {
  updateSystemInstructions: (instructions: Partial<SystemInstructions>) => void;
  updateVoiceConfig: (config: Partial<VoiceConfig>) => void;
  updateStreamingConfig: (config: Partial<StreamingConfig>) => void;
  updateUIPreferences: (preferences: Partial<AppSettings['uiPreferences']>) => void;
  resetToDefaults: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => Promise<void>;
}
interface SettingsStore extends SettingsState, SettingsActions {}
let tauriStore: Store | null = null;
const initTauriStore = async () => {
  if (!tauriStore) {
    try {
      tauriStore = await Store.load('settings.json');
    } catch (error) {
      console.warn('Failed to initialize Tauri store, using localStorage fallback:', error);
    }
  }
  return tauriStore;
};
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultAppSettings,
      isLoading: false,
      error: null,
      updateSystemInstructions: (instructions: Partial<SystemInstructions>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            systemInstructions: {
              ...state.settings.systemInstructions,
              ...instructions,
            },
          },
        }));
        get().saveSettings();
      },
      updateVoiceConfig: (config: Partial<VoiceConfig>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            voiceConfig: {
              ...state.settings.voiceConfig,
              ...config,
            },
          },
        }));
        get().saveSettings();
      },
      updateStreamingConfig: (config: Partial<StreamingConfig>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            streamingConfig: {
              ...state.settings.streamingConfig,
              ...config,
            },
          },
        }));
        get().saveSettings();
      },
      updateUIPreferences: (preferences: Partial<AppSettings['uiPreferences']>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            uiPreferences: {
              ...state.settings.uiPreferences,
              ...preferences,
            },
          },
        }));
        get().saveSettings();
      },
      resetToDefaults: () => {
        set({ settings: defaultAppSettings });
        get().saveSettings();
      },
      loadSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const store = await initTauriStore();
          if (store) {
            const savedSettings = await store.get<AppSettings>('app-settings');
            if (savedSettings) {
              set({ settings: { ...defaultAppSettings, ...savedSettings } });
            }
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
          set({ error: `Failed to load settings: ${error}` });
        } finally {
          set({ isLoading: false });
        }
      },
      saveSettings: async () => {
        try {
          const store = await initTauriStore();
          if (store) {
            await store.set('app-settings', get().settings);
            await store.save();
          }
        } catch (error) {
          console.error('Failed to save settings:', error);
          set({ error: `Failed to save settings: ${error}` });
        }
      },
      exportSettings: () => {
        return JSON.stringify(get().settings, null, 2);
      },
      importSettings: async (settingsJson: string) => {
        try {
          const importedSettings = JSON.parse(settingsJson) as AppSettings;
          set({ settings: { ...defaultAppSettings, ...importedSettings } });
          await get().saveSettings();
        } catch (error) {
          console.error('Failed to import settings:', error);
          set({ error: `Failed to import settings: ${error}` });
          throw error;
        }
      },
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
