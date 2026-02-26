import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Settings, Play, Pause, Square, RotateCcw, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useRealtimeSTT } from '../hooks/useRealtimeSTT';
import { useStreamingTTS } from '../hooks/useStreamingTTS';
import { usePythonBackendStreaming } from '../hooks/usePythonBackendStreaming';
import { usePythonBackendLLM } from '../hooks/usePythonBackendLLM';
import { useSettingsStore } from '../stores/settingsStore';
interface RealtimeVoiceConversationProps {
  isOpen: boolean;
  onClose: () => void;
}
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}
const RealtimeVoiceConversation: React.FC<RealtimeVoiceConversationProps> = ({ isOpen, onClose }) => {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(true);
  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState(true);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [conversationStats, setConversationStats] = useState({
    totalMessages: 0,
    totalDuration: 0,
    averageResponseTime: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { settings } = useSettingsStore();
  const conversationRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    isRecording,
    isConnected: sttConnected,
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
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversationHistory]);
  useEffect(() => {
    if (finalText && finalText.trim().length > 0 && !isRecording && isVoiceInputEnabled) {
      console.log(' Final transcription received, processing with LLM:', finalText);
      handleUserInput(finalText.trim());
      clearResults();
    }
  }, [finalText, isRecording, isVoiceInputEnabled]);
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
  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
    }
  }, [isOpen, checkBackendHealth]);
  const handleUserInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsLoading(true);
    setStatus('processing');
    setStatusMessage('Processing your request...');
    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
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
      const assistantMessage: ConversationMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
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
                ? { ...msg, content: chunk, isStreaming: true }
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
          setConversationHistory(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
          setStatus('speaking');
          setStatusMessage('Speaking response...');
        },
        (error: string) => {
          console.error('❌ Streaming error in conversation:', error);
          setConversationHistory(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: `❌ Error: ${error}`, isStreaming: false }
                : msg
            )
          );
          setStatus('error');
          setStatusMessage(`Error: ${error}`);
        }
      );
    } catch (error) {
      console.error('❌ Error processing user input:', error);
      const errorMessage: ConversationMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error: ${error}`,
        timestamp: new Date()
      };
      setConversationHistory(prev => [...prev, errorMessage]);
      setStatus('error');
      setStatusMessage(`Error: ${error}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (status !== 'error') {
          setStatus('idle');
          setStatusMessage('Ready for voice input');
        }
      }, 2000);
    }
  }, [backendHealth, startBackend, checkBackendHealth, startStream, isVoiceOutputEnabled, stopTTS, clearTTSQueue, addToQueue, status]);
  const handleStartRecording = async () => {
    if (!isVoiceInputEnabled) return;
    try {
      if (!micPermission) {
        await requestMicPermission();
      }
      if (micPermission) {
        await startRecording();
        setStatus('listening');
        setStatusMessage('Listening...');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setStatus('error');
      setStatusMessage('Failed to start recording');
    }
  };
  const handleStopRecording = async () => {
    try {
      await stopRecording();
      setStatus('processing');
      setStatusMessage('Processing speech...');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setStatus('error');
      setStatusMessage('Failed to stop recording');
    }
  };
  const handleToggleVoiceOutput = () => {
    setIsVoiceOutputEnabled(!isVoiceOutputEnabled);
    if (isVoiceOutputEnabled) {
      stopTTS();
      clearTTSQueue();
    }
  };
  const handleToggleVoiceInput = () => {
    setIsVoiceInputEnabled(!isVoiceInputEnabled);
    if (isRecording) {
      stopRecording();
    }
  };
  const handleClearConversation = () => {
    setConversationHistory([]);
    stopTTS();
    clearTTSQueue();
    clearResults();
    setStatus('idle');
    setStatusMessage('Conversation cleared');
  };
  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    if (streamingState.isStreaming) {
      stopStream();
    }
    stopTTS();
    clearTTSQueue();
    clearResults();
    onClose();
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'processing': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'speaking': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };
  const getStatusIcon = () => {
    switch (status) {
      case 'listening': return <Mic className="w-4 h-4 animate-pulse" />;
      case 'processing': return <RotateCcw className="w-4 h-4 animate-spin" />;
      case 'speaking': return <Volume2 className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Mic size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Real-time Voice Conversation
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Continuous voice interaction with your AI assistant
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        {}
        <div className={cn(
          "px-6 py-3 flex items-center justify-between transition-all duration-300",
          getStatusColor()
        )}>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{statusMessage}</span>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <span>Messages: {conversationHistory.length}</span>
            <span>Duration: {formatTime(recordingTime)}</span>
            <div className="flex items-center space-x-1">
              {sttConnected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
              <span>STT</span>
            </div>
            <div className="flex items-center space-x-1">
              {backendHealth ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
              <span>LLM</span>
            </div>
          </div>
        </div>
        {}
        <div className="flex-1 flex flex-col">
          {}
          <div 
            ref={conversationRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {conversationHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Mic className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Start a voice conversation</p>
                <p className="text-sm">Click the microphone button to begin speaking</p>
              </div>
            ) : (
              conversationHistory.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start space-x-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                      message.role === 'user'
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    )}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs opacity-75">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      {message.isStreaming && (
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {}
            {partialText && (
              <div className="flex items-start space-x-3 justify-end">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-600 text-white opacity-75">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs opacity-75">You (typing...)</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                  <p className="text-sm italic">{partialText}</p>
                </div>
              </div>
            )}
          </div>
          {}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              {}
              <div className="flex items-center space-x-4">
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={!isVoiceInputEnabled || !sttConnected}
                  className={cn(
                    "p-4 rounded-full transition-all duration-200 flex items-center justify-center",
                    isRecording
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  )}
                >
                  {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button
                  onClick={handleToggleVoiceOutput}
                  className={cn(
                    "p-3 rounded-full transition-colors",
                    isVoiceOutputEnabled
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-400 text-white hover:bg-gray-500"
                  )}
                >
                  {isVoiceOutputEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={handleToggleVoiceInput}
                  className={cn(
                    "p-3 rounded-full transition-colors",
                    isVoiceInputEnabled
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-400 text-white hover:bg-gray-500"
                  )}
                >
                  {isVoiceInputEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
              </div>
              {}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClearConversation}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsAutoMode(!isAutoMode)}
                  className={cn(
                    "px-3 py-2 text-sm rounded-lg transition-colors",
                    isAutoMode
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  Auto Mode
                </button>
              </div>
            </div>
            {}
            {isRecording && (
              <div className="mt-3 text-center">
                <div className="text-lg font-mono text-blue-600">
                  {formatTime(recordingTime)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Recording in progress...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RealtimeVoiceConversation;
