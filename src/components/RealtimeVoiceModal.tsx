import React, { useState, useEffect } from 'react';
import { X, Mic, Square, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../utils/cn';
import { useRealtimeSTT } from '../hooks/useRealtimeSTT';
import { usePythonBackendLLM } from '../hooks/usePythonBackendLLM';
interface RealtimeVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}
export const RealtimeVoiceModal: React.FC<RealtimeVoiceModalProps> = ({
  isOpen,
  onClose,
  onTranscriptionComplete,
  onRecordingStateChange
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [showFinalTranscription, setShowFinalTranscription] = useState(false);
  const {
    isRecording,
    isConnected,
    partialText,
    finalText,
    error: sttError,
    micPermission,
    requestMicPermission,
    startRecording,
    stopRecording,
    clearResults
  } = useRealtimeSTT();
  const {
    backendHealth,
    checkBackendHealth,
    startBackend
  } = usePythonBackendLLM();
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);
  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);
  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
    }
  }, [isOpen, checkBackendHealth]);
  useEffect(() => {
    if (finalText && finalText.trim().length > 0 && !isRecording) {
      console.log(' Final transcription received:', finalText);
      setShowFinalTranscription(true);
      const timer = setTimeout(() => {
        console.log(' Auto-triggering LLM with final transcription:', finalText);
        handleUseTranscription();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [finalText, isRecording]);
  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    clearResults();
    setShowFinalTranscription(false);
    onClose();
  };
  const handleRequestMicPermission = async () => {
    try {
      await requestMicPermission();
    } catch (error) {
      console.error('❌ Failed to request microphone permission:', error);
    }
  };
  const handleStartRecording = async () => {
    try {
      clearResults();
      setShowFinalTranscription(false);
      await startRecording();
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  };
  const handleStopRecording = () => {
    stopRecording();
    setShowFinalTranscription(true);
  };
  const handleUseTranscription = () => {
    const textToUse = finalText.trim();
    if (textToUse) {
      onTranscriptionComplete(textToUse);
      handleClose();
    }
  };
  const handleStartBackend = async () => {
    try {
      await startBackend();
      await checkBackendHealth();
    } catch (error) {
      console.error('❌ Failed to start backend:', error);
    }
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getConnectionStatus = () => {
    if (!backendHealth) return { icon: WifiOff, text: 'Backend not connected', color: 'text-red-500' };
    if (!backendHealth.vosk_initialized) return { icon: AlertCircle, text: 'STT not initialized', color: 'text-yellow-500' };
    if (!isConnected) return { icon: WifiOff, text: 'WebSocket disconnected', color: 'text-red-500' };
    if (micPermission === 'denied') return { icon: AlertCircle, text: 'Microphone access denied', color: 'text-red-500' };
    if (micPermission === 'prompt') return { icon: AlertCircle, text: 'Microphone permission needed', color: 'text-yellow-500' };
    return { icon: Wifi, text: 'Connected', color: 'text-green-500' };
  };
  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Real-time Voice Input</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {}
        <div className="p-6">
          {}
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <ConnectionIcon className={cn("w-4 h-4", connectionStatus.color)} />
            <span className={cn("text-sm font-medium", connectionStatus.color)}>
              {connectionStatus.text}
            </span>
            {!backendHealth && (
              <button
                onClick={handleStartBackend}
                className="ml-auto px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Start Backend
              </button>
            )}
          </div>
          {}
          {micPermission === 'denied' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Microphone access denied</span>
              </div>
              <div className="text-red-700 text-sm mb-3">
                Please enable microphone access in your browser settings to use voice input.
              </div>
              <button
                onClick={handleRequestMicPermission}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Request Permission
              </button>
            </div>
          )}
          {micPermission === 'prompt' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Microphone permission needed</span>
              </div>
              <div className="text-yellow-700 text-sm mb-3">
                Click below to request microphone access for voice input.
              </div>
              <button
                onClick={handleRequestMicPermission}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Request Permission
              </button>
            </div>
          )}
          {}
          <div className="text-center mb-6">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                disabled={!isConnected || !backendHealth?.vosk_initialized || micPermission !== 'granted'}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200",
                  isConnected && backendHealth?.vosk_initialized && micPermission === 'granted'
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                )}
              >
                <Mic className="w-8 h-8" />
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl animate-pulse"
              >
                <Square className="w-8 h-8" />
              </button>
            )}
            <div className="mt-3">
              {isRecording ? (
                <div className="text-red-600 font-medium">
                  Recording... {formatTime(recordingTime)}
                </div>
              ) : (
                <div className="text-gray-600">
                  {!isConnected || !backendHealth?.vosk_initialized
                    ? "Waiting for connection..."
                    : micPermission === 'denied'
                    ? "Microphone access denied"
                    : micPermission === 'prompt'
                    ? "Microphone permission needed"
                    : "Click to start recording"}
                </div>
              )}
            </div>
          </div>
          {}
          <div className="space-y-3">
            {}
            {partialText && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-xs text-blue-600 font-medium mb-1">Live transcription:</div>
                <div className="text-blue-800 italic">{partialText}</div>
              </div>
            )}
            {}
            {finalText && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-green-600 font-medium mb-1">Final transcription:</div>
                <div className="text-green-800">{finalText}</div>
              </div>
            )}
            {}
            {sttError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Error:</span>
                </div>
                <div className="text-red-800 text-sm mt-1">{sttError}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={clearResults}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Clear Error
                  </button>
                  {!isConnected && (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Refresh Page
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {}
          {showFinalTranscription && finalText && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={clearResults}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear & Retry
              </button>
              <button
                onClick={handleUseTranscription}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Use Transcription
              </button>
            </div>
          )}
        </div>
        {}
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
          <div className="text-xs text-gray-500 text-center">
            Real-time speech recognition powered by Vosk
          </div>
        </div>
      </div>
    </div>
  );
};
export default RealtimeVoiceModal;
