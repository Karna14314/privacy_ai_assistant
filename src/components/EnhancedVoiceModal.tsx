import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Play,
  Pause,
  Square,
  Send,
  X,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useEnhancedVoice } from '../hooks/useEnhancedVoice';
import { useSettingsStore } from '../stores/settingsStore';
interface EnhancedVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  onSendMessage?: (text: string) => void;
  autoSend?: boolean;
}
const EnhancedVoiceModal: React.FC<EnhancedVoiceModalProps> = ({
  isOpen,
  onClose,
  onTranscriptionComplete,
  onSendMessage,
  autoSend = false
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [editableTranscription, setEditableTranscription] = useState('');
  const { settings, updateVoiceConfig } = useSettingsStore();
  const {
    voiceState,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    getAvailableVoices,
    setVoice,
    requestMicrophonePermission
  } = useEnhancedVoice();
  useEffect(() => {
    if (voiceState.transcription) {
      setEditableTranscription(voiceState.transcription);
    }
  }, [voiceState.transcription]);
  useEffect(() => {
    if (autoSend && voiceState.transcription && !voiceState.isRecording && voiceState.confidence > 0.7) {
      handleSendTranscription();
    }
  }, [autoSend, voiceState.transcription, voiceState.isRecording, voiceState.confidence]);
  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };
  const handleStopRecording = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };
  const handleSendTranscription = () => {
    const text = editableTranscription.trim();
    if (text) {
      onTranscriptionComplete(text);
      onClose();
    }
  };
  const handleTestTTS = async () => {
    if (editableTranscription.trim()) {
      try {
        await speakText(editableTranscription, { interrupt: true });
      } catch (error) {
        console.error('TTS test failed:', error);
      }
    }
  };
  const handleVoiceProviderChange = (provider: 'web-speech' | 'vosk' | 'whisper') => {
    updateVoiceConfig({ voiceProvider: provider });
  };
  const handleLanguageChange = (language: string) => {
    updateVoiceConfig({ sttLanguage: language });
  };
  const handleVoiceChange = (voiceName: string) => {
    const voices = getAvailableVoices();
    const selectedVoice = voices.find(voice => voice.name === voiceName);
    if (selectedVoice) {
      setVoice(selectedVoice);
    }
  };
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };
  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return CheckCircle;
    if (confidence >= 0.6) return AlertCircle;
    return AlertCircle;
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Enhanced Voice Input
          </h2>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Voice Settings"
            >
              <Settings size={20} />
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
        {}
        {showSettings && (
          <div className="p-6 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice Provider
                </label>
                <select
                  value={settings.voiceConfig.voiceProvider}
                  onChange={(e) => handleVoiceProviderChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="web-speech">Web Speech API</option>
                  <option value="vosk">Vosk (Offline)</option>
                  <option value="whisper">Whisper (Tauri)</option>
                </select>
              </div>
              {}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={settings.voiceConfig.sttLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                  <option value="pt-BR">Portuguese (Brazil)</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="ko-KR">Korean</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                </select>
              </div>
              {}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  TTS Voice
                </label>
                <select
                  value={voiceState.selectedVoice?.name || ''}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {getAvailableVoices().map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
              {}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoPlayTTS"
                  checked={settings.voiceConfig.autoPlayTTS}
                  onChange={(e) => updateVoiceConfig({ autoPlayTTS: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="autoPlayTTS" className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-play TTS responses
                </label>
              </div>
            </div>
          </div>
        )}
        {}
        <div className="p-6">
          {}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <button
              type="button"
              onClick={voiceState.isRecording ? handleStopRecording : handleStartRecording}
              disabled={voiceState.isProcessing}
              className={cn(
                "p-4 rounded-full transition-all duration-200",
                voiceState.isRecording
                  ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
                voiceState.isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {voiceState.isProcessing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : voiceState.isRecording ? (
                <Square size={24} />
              ) : (
                <Mic size={24} />
              )}
            </button>
            {}
            <button
              type="button"
              onClick={voiceState.isTTSPlaying ? stopSpeaking : handleTestTTS}
              disabled={!editableTranscription.trim() || voiceState.isProcessing}
              className={cn(
                "p-3 rounded-full transition-colors",
                voiceState.isTTSPlaying
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white",
                (!editableTranscription.trim() || voiceState.isProcessing) && "opacity-50 cursor-not-allowed"
              )}
            >
              {voiceState.isTTSPlaying ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
          {}
          <div className="text-center mb-4">
            {voiceState.isRecording && (
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                 Listening... Speak now
              </p>
            )}
            {voiceState.isProcessing && (
              <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                ⏳ Processing audio...
              </p>
            )}
            {voiceState.isTTSPlaying && (
              <p className="text-green-600 dark:text-green-400 font-medium">
                 Playing text-to-speech...
              </p>
            )}
            {voiceState.error && (
              <p className="text-red-600 dark:text-red-400 font-medium">
                ❌ {voiceState.error}
              </p>
            )}
          </div>
          {}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Transcription
              </label>
              {voiceState.confidence > 0 && (
                <div className="flex items-center space-x-1">
                  {React.createElement(getConfidenceIcon(voiceState.confidence), {
                    size: 16,
                    className: getConfidenceColor(voiceState.confidence)
                  })}
                  <span className={cn("text-xs font-medium", getConfidenceColor(voiceState.confidence))}>
                    {Math.round(voiceState.confidence * 100)}% confident
                  </span>
                </div>
              )}
            </div>
            <textarea
              value={editableTranscription}
              onChange={(e) => setEditableTranscription(e.target.value)}
              placeholder="Your transcribed text will appear here. You can edit it before sending."
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendTranscription}
              disabled={!editableTranscription.trim()}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors",
                !editableTranscription.trim() && "opacity-50 cursor-not-allowed"
              )}
            >
              <Send size={16} />
              <span>Send Message</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EnhancedVoiceModal;
