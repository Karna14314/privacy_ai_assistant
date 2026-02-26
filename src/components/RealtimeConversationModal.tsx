import React, { useState, useEffect, useCallback } from 'react';
import { X, Mic, Square, Volume2, VolumeX, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useRealtimeSTT } from '../hooks/useRealtimeSTT';
import { useStreamingTTS } from '../hooks/useStreamingTTS';
import { usePythonBackendStreaming } from '../hooks/usePythonBackendStreaming';
import { usePythonBackendLLM } from '../hooks/usePythonBackendLLM';
interface RealtimeConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export const RealtimeConversationModal: React.FC<RealtimeConversationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [conversationHistory, setConversationHistory] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
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
    ttsState,
    addToQueue,
    stop: stopTTS,
    clearQueue: clearTTSQueue
  } = useStreamingTTS();
  const {
    streamingState,
    startStream,
    stopStream
  } = usePythonBackendStreaming();
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
    if (finalText && finalText.trim().length > 0 && !isRecording) {
      console.log(' Final transcription received, processing with LLM:', finalText);
      handleUserInput(finalText.trim());
      clearResults();
    }
  }, [finalText, isRecording]);
  useEffect(() => {
    if (streamingState.streamedContent && isVoiceOutputEnabled) {
      const newContent = streamingState.streamedContent;
      if (newContent.length > 0) {
        const words = newContent.split(' ');
        if (words.length >= 3) {
          const lastFewWords = words.slice(-3).join(' ');
          addToQueue(lastFewWords);
        }
      }
    }
  }, [streamingState.streamedContent, isVoiceOutputEnabled, addToQueue]);
  const handleClose = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    if (streamingState.isStreaming) {
      stopStream();
    }
    stopTTS();
    clearTTSQueue();
    clearResults();
    setConversationHistory([]);
    onClose();
  }, [isRecording, streamingState.isStreaming, stopRecording, stopStream, stopTTS, clearTTSQueue, clearResults, onClose]);
  const handleUserInput = useCallback(async (text: string) => {
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: text,
      timestamp: new Date()
    };
    setConversationHistory(prev => [...prev, userMessage]);
    stopTTS();
    clearTTSQueue();
    try {
      if (!backendHealth) {
        console.log(' Starting Python backend...');
        await startBackend();
        await checkBackendHealth();
      }
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date()
      };
      setConversationHistory(prev => [...prev, assistantMessage]);
      await startStream(
        text,
        'llama3.1:8b',
        (chunk: string) => {
          console.log(' Streaming chunk received for conversation:', chunk.length, 'chars');
          setConversationHistory(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: chunk }
                : msg
            )
          );
          if (isVoiceOutputEnabled && chunk.length > assistantMessage.content.length + 10) {
            const newContent = chunk.substring(assistantMessage.content.length);
            if (newContent.trim()) {
              addToQueue(newContent);
            }
          }
        },
        () => {
          console.log('✅ Streaming completed for conversation');
        },
        (error: string) => {
          console.error('❌ Streaming error in conversation:', error);
          setConversationHistory(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: `❌ Error: ${error}` }
                : msg
            )
          );
        }
      );
    } catch (error) {
      console.error('❌ Error processing user input:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: `❌ Error: ${error}`,
        timestamp: new Date()
      };
      setConversationHistory(prev => [...prev, errorMessage]);
    }
  }, [backendHealth, startBackend, checkBackendHealth, startStream, isVoiceOutputEnabled, stopTTS, clearTTSQueue, addToQueue]);
  const handleStartRecording = useCallback(async () => {
    try {
      stopTTS();
      clearTTSQueue();
      if (streamingState.isStreaming) {
        stopStream();
      }
      clearResults();
      await startRecording();
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  }, [stopTTS, clearTTSQueue, streamingState.isStreaming, stopStream, clearResults, startRecording]);
  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);
  const handleToggleVoiceOutput = useCallback(() => {
    if (isVoiceOutputEnabled) {
      stopTTS();
      clearTTSQueue();
    }
    setIsVoiceOutputEnabled(!isVoiceOutputEnabled);
  }, [isVoiceOutputEnabled, stopTTS, clearTTSQueue]);
  const handleRequestMicPermission = useCallback(async () => {
    try {
      await requestMicPermission();
    } catch (error) {
      console.error('❌ Failed to request microphone permission:', error);
    }
  }, [requestMicPermission]);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getConnectionStatus = () => {
    if (!backendHealth) return { icon: WifiOff, text: 'Backend not connected', color: 'text-red-500' };
    if (!isConnected) return { icon: WifiOff, text: 'STT disconnected', color: 'text-red-500' };
    if (micPermission === 'denied') return { icon: AlertCircle, text: 'Microphone denied', color: 'text-red-500' };
    if (micPermission === 'prompt') return { icon: AlertCircle, text: 'Microphone needed', color: 'text-yellow-500' };
    return { icon: Wifi, text: 'Connected', color: 'text-green-500' };
  };
  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 h-[80vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Real-time Voice Conversation
          </h2>
          <div className="flex items-center gap-3">
            {}
            <button
              type="button"
              onClick={handleToggleVoiceOutput}
              className={cn(
                "p-2 rounded-full transition-colors",
                isVoiceOutputEnabled
                  ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
              )}
              title={isVoiceOutputEnabled ? "Disable voice output" : "Enable voice output"}
            >
              {isVoiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {}
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Close conversation"
              aria-label="Close conversation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <ConnectionIcon className={cn("w-4 h-4", connectionStatus.color)} />
          <span className={cn("text-sm font-medium", connectionStatus.color)}>
            {connectionStatus.text}
          </span>
          {ttsState.isPlaying && (
            <>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <Volume2 className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-sm text-blue-600 dark:text-blue-400">Speaking...</span>
            </>
          )}
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversationHistory.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start a voice conversation by clicking the microphone below</p>
            </div>
          ) : (
            conversationHistory.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg",
                    message.role === 'user'
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {}
        {(partialText || isRecording) && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
              {isRecording ? "Listening..." : "Processing..."}
            </div>
            <div className="text-blue-800 dark:text-blue-200 italic">
              {partialText || "Speak now..."}
            </div>
          </div>
        )}
        {}
        {sttError && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{sttError}</span>
            </div>
          </div>
        )}
        {}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-4">
            {}
            {micPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestMicPermission}
                className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                Grant Microphone Access
              </button>
            )}
            {}
            {micPermission === 'granted' && (
              <div className="text-center">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={!isConnected || !backendHealth}
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                      isConnected && backendHealth
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    )}
                    title="Start recording"
                    aria-label="Start voice recording"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl animate-pulse"
                    title="Stop recording"
                    aria-label="Stop voice recording"
                  >
                    <Square className="w-8 h-8" />
                  </button>
                )}
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {isRecording ? (
                    <span className="text-red-600 font-medium">
                      Recording... {formatTime(recordingTime)}
                    </span>
                  ) : (
                    "Tap to speak"
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RealtimeConversationModal;
