import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, User, Bot, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { cn } from '../utils/cn';
import { useEnhancedVoice } from '../hooks/useEnhancedVoice';
interface MessageBubbleProps {
  message: Message;
  onCopy?: () => void;
  isStreaming?: boolean;
  streamingText?: string;
}
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onCopy,
  isStreaming = false,
  streamingText = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const voice = useEnhancedVoice();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };
  const handleTTS = async () => {
    if (isTTSPlaying) {
      voice.stopSpeaking();
      setIsTTSPlaying(false);
    } else {
      try {
        setIsTTSPlaying(true);
        await voice.speakText(message.content, { interrupt: true });
        setIsTTSPlaying(false);
      } catch (error) {
        console.error('TTS failed:', error);
        setIsTTSPlaying(false);
      }
    }
  };
  const formatTimestamp = (timestamp: Date | string | number | undefined): string => {
    if (!timestamp) return 'Unknown';
    const time = new Date(timestamp);
    if (isNaN(time.getTime())) {
      return 'Invalid time';
    }
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(time);
  };
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  return (
    <div
      className={cn(
        'group flex w-full gap-3 px-4 py-3 animate-fade-in',
        isUser && 'flex-row-reverse',
        isAssistant && 'flex-row'
      )}
    >
      {}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
          isUser && 'bg-primary-600',
          isAssistant && 'bg-gray-600 dark:bg-gray-500'
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      {}
      <div className={cn('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        {}
        <div
          className={cn(
            'relative max-w-[70%] rounded-2xl px-4 py-2 shadow-sm transition-all duration-200',
            isUser && 'bg-primary-600 text-white',
            isAssistant && 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
            isStreaming && isAssistant && 'ring-2 ring-blue-200 dark:ring-blue-800 ring-opacity-50'
          )}
        >
          {}
          {message.isLoading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <div className="loading-dots">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span className="text-sm">Thinking...</span>
            </div>
          )}
          {}
          {message.error && (
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
              <span className="text-sm">Error: {message.error}</span>
            </div>
          )}
          {}
          {!message.isLoading && !message.error && (
            <div className="prose prose-sm max-w-none">
              {isAssistant ? (
                <div className="relative">
                  <ReactMarkdown
                    className={cn(
                      'markdown-content',
                      'prose-headings:text-gray-900 dark:prose-headings:text-gray-100',
                      'prose-p:text-gray-700 dark:prose-p:text-gray-300',
                      'prose-strong:text-gray-900 dark:prose-strong:text-gray-100',
                      'prose-code:text-gray-800 dark:prose-code:text-gray-200',
                      'prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800',
                      'prose-ul:text-gray-700 dark:prose-ul:text-gray-300',
                      'prose-ol:text-gray-700 dark:prose-ol:text-gray-300',
                      'prose-li:text-gray-700 dark:prose-li:text-gray-300'
                    )}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm">
                            {children}
                          </code>
                        ) : (
                          <code className={className}>{children}</code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                          {children}
                        </pre>
                      )
                    }}
                  >
                    {}
                    {(() => {
                      const content = message.content || streamingText || '';
                      const trimmedContent = content.trim();
                      if (trimmedContent === 'Thinking...' || trimmedContent === '') {
                        return 'Thinking...';
                      }
                      if (trimmedContent === 'No content available') {
                        return 'No response generated. Please try again.';
                      }
                      return trimmedContent || 'Processing...';
                    })()}
                  </ReactMarkdown>
                  {}
                  {(isStreaming || (message.metadata?.isStreaming && !message.metadata?.isPlaceholder)) && (
                    <span className="inline-flex items-center ml-2" aria-label="AI is typing">
                      <span className="flex space-x-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce-delay-0"></span>
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce-delay-150"></span>
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce-delay-300"></span>
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {}
                  {message.content || 'No content available'}
                </p>
              )}
            </div>
          )}
          {}
          {!message.isLoading && !message.error && (
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {}
              {isAssistant && message.content && message.content.trim() && (
                <button
                  type="button"
                  onClick={handleTTS}
                  className={cn(
                    'p-1 rounded hover:bg-black/10 dark:hover:bg-white/10',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                    isTTSPlaying && 'bg-blue-100 dark:bg-blue-900/30'
                  )}
                  aria-label={isTTSPlaying ? "Stop reading message" : "Read message aloud"}
                  disabled={isStreaming}
                >
                  {isTTSPlaying ? (
                    <VolumeX size={14} className="text-blue-600" />
                  ) : (
                    <Volume2 size={14} className="text-gray-500 dark:text-gray-400 hover:text-blue-600" />
                  )}
                </button>
              )}
              {}
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'p-1 rounded hover:bg-black/10 dark:hover:bg-white/10',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                )}
                aria-label="Copy message"
              >
                {copied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          )}
        </div>
        {}
        <div
          className={cn(
            'mt-1 text-xs text-gray-500 dark:text-gray-400',
            isUser && 'text-right'
          )}
        >
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
export default MessageBubble;
