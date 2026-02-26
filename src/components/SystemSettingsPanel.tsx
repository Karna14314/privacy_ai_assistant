import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Upload,
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { SystemInstructions } from '../types';
interface SystemSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
const SystemSettingsPanel: React.FC<SystemSettingsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'behavior' | 'context' | 'ui' | 'voice' | 'streaming'>('system');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [localSettings, setLocalSettings] = useState<SystemInstructions | null>(null);
  const {
    settings,
    updateSystemInstructions,
    updateVoiceConfig,
    updateStreamingConfig,
    updateUIPreferences,
    resetToDefaults,
    exportSettings,
    importSettings,
    isLoading,
    error
  } = useSettingsStore();
  useEffect(() => {
    if (settings.systemInstructions) {
      setLocalSettings({ ...settings.systemInstructions });
    }
  }, [settings.systemInstructions]);
  useEffect(() => {
    if (localSettings && settings.systemInstructions) {
      const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings.systemInstructions);
      setHasUnsavedChanges(hasChanges);
    }
  }, [localSettings, settings.systemInstructions]);
  const handleSaveSettings = async () => {
    if (localSettings) {
      updateSystemInstructions(localSettings);
      setHasUnsavedChanges(false);
    }
  };
  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetToDefaults();
      setHasUnsavedChanges(false);
    }
  };
  const handleExportSettings = () => {
    try {
      const settingsJson = exportSettings();
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-assistant-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  };
  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importSettings(text);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to import settings:', error);
        alert('Failed to import settings. Please check the file format.');
      }
    };
    input.click();
  };
  const handleCopySystemPrompt = () => {
    if (localSettings?.systemPrompt) {
      navigator.clipboard.writeText(localSettings.systemPrompt);
    }
  };
  const tabs = [
    { id: 'system', label: 'System Instructions', icon: Settings },
    { id: 'behavior', label: 'Behavior', icon: Info },
    { id: 'context', label: 'Context', icon: Eye },
    { id: 'voice', label: 'Voice', icon: Settings },
    { id: 'streaming', label: 'Streaming', icon: Settings },
    { id: 'ui', label: 'Interface', icon: Settings }
  ];
  if (!isOpen || !localSettings) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              System Settings
            </h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportSettings}
              className="flex items-center space-x-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={handleImportSettings}
              className="flex items-center space-x-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Upload size={16} />
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex h-[calc(90vh-120px)]">
          {}
          <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors",
                      activeTab === tab.id
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <IconComponent size={18} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          {}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      System Prompt
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                        title={showSystemPrompt ? "Hide prompt" : "Show prompt"}
                      >
                        {showSystemPrompt ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopySystemPrompt}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                        title="Copy to clipboard"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={localSettings.systemPrompt}
                    onChange={(e) => setLocalSettings(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                    placeholder="Enter your system instructions here..."
                    className={cn(
                      "w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500",
                      !showSystemPrompt && "filter blur-sm"
                    )}
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    This prompt will be sent to the AI model before every conversation to establish its behavior and personality.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Prompt Template
                  </label>
                  <textarea
                    value={localSettings.promptTemplate}
                    onChange={(e) => setLocalSettings(prev => prev ? { ...prev, promptTemplate: e.target.value } : null)}
                    placeholder="Template for formatting user messages..."
                    className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Use {'{system_prompt}'} and {'{user_message}'} as placeholders.
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'behavior' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Response Style
                  </label>
                  <select
                    value={localSettings.behaviorSettings.responseStyle}
                    onChange={(e) => setLocalSettings(prev => prev ? {
                      ...prev,
                      behaviorSettings: {
                        ...prev.behaviorSettings,
                        responseStyle: e.target.value as any
                      }
                    } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                    <option value="conversational">Conversational</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Creativity Level: {Math.round(localSettings.behaviorSettings.creativityLevel * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localSettings.behaviorSettings.creativityLevel}
                    onChange={(e) => setLocalSettings(prev => prev ? {
                      ...prev,
                      behaviorSettings: {
                        ...prev.behaviorSettings,
                        creativityLevel: parseFloat(e.target.value)
                      }
                    } : null)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Conservative</span>
                    <span>Creative</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useEmojis"
                      checked={localSettings.behaviorSettings.useEmojis}
                      onChange={(e) => setLocalSettings(prev => prev ? {
                        ...prev,
                        behaviorSettings: {
                          ...prev.behaviorSettings,
                          useEmojis: e.target.checked
                        }
                      } : null)}
                      className="mr-3"
                    />
                    <label htmlFor="useEmojis" className="text-sm text-gray-700 dark:text-gray-300">
                      Use emojis in responses
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeThinking"
                      checked={localSettings.behaviorSettings.includeThinking}
                      onChange={(e) => setLocalSettings(prev => prev ? {
                        ...prev,
                        behaviorSettings: {
                          ...prev.behaviorSettings,
                          includeThinking: e.target.checked
                        }
                      } : null)}
                      className="mr-3"
                    />
                    <label htmlFor="includeThinking" className="text-sm text-gray-700 dark:text-gray-300">
                      Show thinking process
                    </label>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'context' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Max Context Length
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="32000"
                    step="1000"
                    value={localSettings.contextSettings.maxContextLength}
                    onChange={(e) => setLocalSettings(prev => prev ? {
                      ...prev,
                      contextSettings: {
                        ...prev.contextSettings,
                        maxContextLength: parseInt(e.target.value)
                      }
                    } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Maximum number of tokens to include in context window.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeSystemInfo"
                      checked={localSettings.contextSettings.includeSystemInfo}
                      onChange={(e) => setLocalSettings(prev => prev ? {
                        ...prev,
                        contextSettings: {
                          ...prev.contextSettings,
                          includeSystemInfo: e.target.checked
                        }
                      } : null)}
                      className="mr-3"
                    />
                    <label htmlFor="includeSystemInfo" className="text-sm text-gray-700 dark:text-gray-300">
                      Include system information in context
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeChatHistory"
                      checked={localSettings.contextSettings.includeChatHistory}
                      onChange={(e) => setLocalSettings(prev => prev ? {
                        ...prev,
                        contextSettings: {
                          ...prev.contextSettings,
                          includeChatHistory: e.target.checked
                        }
                      } : null)}
                      className="mr-3"
                    />
                    <label htmlFor="includeChatHistory" className="text-sm text-gray-700 dark:text-gray-300">
                      Include chat history in context
                    </label>
                  </div>
                </div>
              </div>
            )}
            {}
            {activeTab === 'voice' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="sttEnabled"
                        checked={settings.voiceConfig.sttEnabled}
                        onChange={(e) => updateVoiceConfig({ sttEnabled: e.target.checked })}
                        className="mr-3"
                      />
                      <label htmlFor="sttEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                        Enable Speech-to-Text
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="ttsEnabled"
                        checked={settings.voiceConfig.ttsEnabled}
                        onChange={(e) => updateVoiceConfig({ ttsEnabled: e.target.checked })}
                        className="mr-3"
                      />
                      <label htmlFor="ttsEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                        Enable Text-to-Speech
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="autoPlayTTS"
                        checked={settings.voiceConfig.autoPlayTTS}
                        onChange={(e) => updateVoiceConfig({ autoPlayTTS: e.target.checked })}
                        className="mr-3"
                      />
                      <label htmlFor="autoPlayTTS" className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-play TTS responses
                      </label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Voice Provider
                      </label>
                      <select
                        value={settings.voiceConfig.voiceProvider}
                        onChange={(e) => updateVoiceConfig({ voiceProvider: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="web-speech">Web Speech API</option>
                        <option value="vosk">Vosk (Offline)</option>
                        <option value="whisper">Whisper (Tauri)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        STT Language
                      </label>
                      <select
                        value={settings.voiceConfig.sttLanguage}
                        onChange={(e) => updateVoiceConfig({ sttLanguage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {}
            {activeTab === 'streaming' && (
              <div className="space-y-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="streamingEnabled"
                    checked={settings.streamingConfig.enabled}
                    onChange={(e) => updateStreamingConfig({ enabled: e.target.checked })}
                    className="mr-3"
                  />
                  <label htmlFor="streamingEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    Enable streaming responses
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Chunk Size: {settings.streamingConfig.chunkSize} words
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={settings.streamingConfig.chunkSize}
                    onChange={(e) => updateStreamingConfig({ chunkSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Delay: {settings.streamingConfig.delayMs}ms
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={settings.streamingConfig.delayMs}
                    onChange={(e) => updateStreamingConfig({ delayMs: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoScroll"
                    checked={settings.streamingConfig.autoScroll}
                    onChange={(e) => updateStreamingConfig({ autoScroll: e.target.checked })}
                    className="mr-3"
                  />
                  <label htmlFor="autoScroll" className="text-sm text-gray-700 dark:text-gray-300">
                    Auto-scroll during streaming
                  </label>
                </div>
              </div>
            )}
            {}
            {activeTab === 'ui' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showPluginSidebar"
                      checked={settings.uiPreferences.showPluginSidebar}
                      onChange={(e) => updateUIPreferences({ showPluginSidebar: e.target.checked })}
                      className="mr-3"
                    />
                    <label htmlFor="showPluginSidebar" className="text-sm text-gray-700 dark:text-gray-300">
                      Show plugin sidebar
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showSystemStatus"
                      checked={settings.uiPreferences.showSystemStatus}
                      onChange={(e) => updateUIPreferences({ showSystemStatus: e.target.checked })}
                      className="mr-3"
                    />
                    <label htmlFor="showSystemStatus" className="text-sm text-gray-700 dark:text-gray-300">
                      Show system status indicators
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="compactMode"
                      checked={settings.uiPreferences.compactMode}
                      onChange={(e) => updateUIPreferences({ compactMode: e.target.checked })}
                      className="mr-3"
                    />
                    <label htmlFor="compactMode" className="text-sm text-gray-700 dark:text-gray-300">
                      Compact mode
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center space-x-2">
            {error && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertTriangle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Saving...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="flex items-center space-x-1 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              <span>Reset to Defaults</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!hasUnsavedChanges || isLoading}
              className={cn(
                "flex items-center space-x-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg transition-colors",
                (!hasUnsavedChanges || isLoading) 
                  ? "opacity-50 cursor-not-allowed" 
                  : "hover:bg-blue-700"
              )}
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SystemSettingsPanel;
