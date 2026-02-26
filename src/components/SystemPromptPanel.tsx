import React, { useState, useEffect } from 'react';
import { X, Save, Copy, Eye, EyeOff, RotateCcw, FileText } from 'lucide-react';
import { cn } from '../utils/cn';
import { useSettingsStore } from '../stores/settingsStore';
interface SystemPromptPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
const SystemPromptPanel: React.FC<SystemPromptPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [localSystemPrompt, setLocalSystemPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { settings, updateSystemInstructions } = useSettingsStore();
  useEffect(() => {
    if (settings.systemInstructions.systemPrompt) {
      setLocalSystemPrompt(settings.systemInstructions.systemPrompt);
    }
  }, [settings.systemInstructions.systemPrompt]);
  useEffect(() => {
    const hasChanges = localSystemPrompt !== settings.systemInstructions.systemPrompt;
    setHasUnsavedChanges(hasChanges);
  }, [localSystemPrompt, settings.systemInstructions.systemPrompt]);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSystemInstructions({ systemPrompt: localSystemPrompt });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    } finally {
      setIsSaving(false);
    }
  };
  const handleReset = () => {
    setLocalSystemPrompt(settings.systemInstructions.systemPrompt);
    setHasUnsavedChanges(false);
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(localSystemPrompt);
  };
  const defaultPrompt = `You are a helpful, privacy-focused AI assistant. You run locally to protect user privacy. 
Be concise but informative, and always prioritize user privacy and security.`;
  const handleUseDefault = () => {
    setLocalSystemPrompt(defaultPrompt);
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FileText size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                System Prompt Editor
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure how the AI assistant behaves
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  System Prompt
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                    title={showPrompt ? "Hide prompt" : "Show prompt"}
                  >
                    {showPrompt ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                    title="Copy to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <textarea
                value={localSystemPrompt}
                onChange={(e) => setLocalSystemPrompt(e.target.value)}
                placeholder="Enter your system instructions here..."
                className={cn(
                  "w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500",
                  !showPrompt && "filter blur-sm"
                )}
                disabled={!showPrompt}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                This prompt defines how the AI assistant will behave and respond to your messages.
              </p>
            </div>
            {}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleUseDefault}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50"
                >
                  Use Default
                </button>
                <button
                  onClick={() => setLocalSystemPrompt('')}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
            </div>
            {}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Characters:</span>
                  <span className="font-mono">{localSystemPrompt.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Words:</span>
                  <span className="font-mono">{localSystemPrompt.split(/\s+/).filter(w => w.length > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Changes:</span>
                  <span className={cn(
                    "font-medium",
                    hasUnsavedChanges ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {hasUnsavedChanges ? "Unsaved" : "Saved"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            disabled={!hasUnsavedChanges}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SystemPromptPanel;
