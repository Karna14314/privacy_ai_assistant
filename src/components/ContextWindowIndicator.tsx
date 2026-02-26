import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  RotateCcw,
  Info,
  TrendingUp,
  Clock
} from 'lucide-react';
import { cn } from '../utils/cn';
interface ContextWindowIndicatorProps {
  className?: string;
  tokenCount: number;
  maxTokens?: number;
  onPruneRequested?: () => void;
  onClearContext?: () => void;
  isOptimizing?: boolean;
  lastOptimization?: Date;
}
interface ContextStatus {
  level: 'safe' | 'warning' | 'critical';
  color: string;
  bgColor: string;
  message: string;
  percentage: number;
}
export const ContextWindowIndicator: React.FC<ContextWindowIndicatorProps> = ({
  className,
  tokenCount,
  maxTokens = 32768,
  onPruneRequested,
  onClearContext,
  isOptimizing = false,
  lastOptimization
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  const getContextStatus = (): ContextStatus => {
    const percentage = (tokenCount / maxTokens) * 100;
    if (percentage >= 90) {
      return {
        level: 'critical',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        message: 'Context window nearly full - optimization needed',
        percentage
      };
    } else if (percentage >= 70) {
      return {
        level: 'warning',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        message: 'Context window filling up',
        percentage
      };
    } else {
      return {
        level: 'safe',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        message: 'Context window healthy',
        percentage
      };
    }
  };
  const status = getContextStatus();
  const formatTokenCount = (count: number): string => {
    return count.toLocaleString();
  };
  const tokensRemaining = Math.max(0, maxTokens - tokenCount);
  useEffect(() => {
    if (isOptimizing) {
      setAnimationClass('animate-pulse');
    } else {
      setAnimationClass('');
      setTimeout(() => {
        setAnimationClass('animate-bounce');
        setTimeout(() => setAnimationClass(''), 1000);
      }, 100);
    }
  }, [isOptimizing]);
  return (
    <div className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      {}
      <div 
        className={cn(
          'p-3 cursor-pointer transition-all duration-200',
          status.bgColor,
          animationClass
        )}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain size={20} className={status.color} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  Context Window
                </span>
                {isOptimizing && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <RotateCcw size={12} className="animate-spin" />
                    <span>Optimizing...</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {formatTokenCount(tokenCount)} / {formatTokenCount(maxTokens)} tokens
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {}
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                {}
                <path
                  className="text-gray-200 dark:text-gray-700"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {}
                <path
                  className={status.color}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={`${status.percentage}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-xs font-medium', status.color)}>
                  {Math.round(status.percentage)}%
                </span>
              </div>
            </div>
            {}
            {status.level === 'critical' && <AlertTriangle size={16} className={status.color} />}
            {status.level === 'warning' && <TrendingUp size={16} className={status.color} />}
            {status.level === 'safe' && <CheckCircle size={16} className={status.color} />}
          </div>
        </div>
        {}
        <div className={cn('mt-2 text-xs', status.color)}>
          {status.message}
        </div>
      </div>
      {}
      {showDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
          {}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-600 dark:text-gray-400">Used</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatTokenCount(tokenCount)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <div className="text-gray-600 dark:text-gray-400">Remaining</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatTokenCount(tokensRemaining)}
              </div>
            </div>
          </div>
          {}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Memory Usage</span>
              <span>{Math.round(status.percentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={cn(
                  'h-2 rounded-full transition-all duration-500',
                  status.level === 'critical' ? 'bg-red-500' :
                  status.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                )}
                style={{ width: `${Math.min(status.percentage, 100)}%` }}
              />
            </div>
          </div>
          {}
          {lastOptimization && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Clock size={12} />
              <span>
                Last optimized: {lastOptimization.toLocaleTimeString()}
              </span>
            </div>
          )}
          {}
          <div className="flex gap-2 pt-2">
            {status.level !== 'safe' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPruneRequested?.();
                }}
                disabled={isOptimizing}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={12} />
                Optimize Memory
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearContext?.();
              }}
              disabled={isOptimizing}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={12} />
              Clear All
            </button>
          </div>
          {}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-blue-800 dark:text-blue-200">
                <div className="font-medium mb-1">Context Management</div>
                <div className="text-blue-700 dark:text-blue-300">
                  When memory reaches 90%, old conversations are automatically pruned while preserving:
                  system instructions, recent messages, and current conversation thread.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ContextWindowIndicator;
