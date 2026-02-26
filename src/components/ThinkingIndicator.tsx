import React from 'react';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
interface ThinkingIndicatorProps {
  isVisible: boolean;
  className?: string;
  streamingText?: string;
  isStreaming?: boolean;
}
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isVisible,
  className = '',
  streamingText = '',
  isStreaming = false
}) => {
  if (!isVisible) return null;
  return (
    <div className={cn(
      'flex items-center justify-center py-4 px-6 mx-4 mb-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg border border-blue-200 dark:border-blue-700',
      className
    )}>
      <div className="flex items-center space-x-3">
        {}
        <div className="relative">
          <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-3 h-3 text-purple-500 animate-spin" />
          </div>
        </div>
        {}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            AI is thinking
          </span>
          {}
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
          </div>
        </div>
        {}
        <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    </div>
  );
};
export default ThinkingIndicator;
