import React, { useState, useEffect } from 'react';
import { Activity, WifiOff, Brain, Mic, Volume2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { ModelHealthStatus } from '../utils/modelHealth';
interface StatusBarProps {
  modelHealth: ModelHealthStatus;
  isThinking?: boolean;
  isListening?: boolean;
  isSpeaking?: boolean;
  className?: string;
}
type SystemStatus = 'healthy' | 'warning' | 'error' | 'offline';
export const StatusBar: React.FC<StatusBarProps> = ({
  modelHealth,
  isThinking = false,
  isListening = false,
  isSpeaking = false,
  className = ''
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const getSystemStatus = (): SystemStatus => {
    if (!modelHealth.isAvailable) {
      return modelHealth.connectionState === 'error' ? 'error' : 'offline';
    }
    if (modelHealth.error) {
      return 'warning';
    }
    return 'healthy';
  };
  const getStatusColor = (status: SystemStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'offline':
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  const getStatusIcon = (status: SystemStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      case 'offline':
        return <WifiOff className="w-4 h-4" />;
    }
  };
  const getCurrentActivity = () => {
    if (isListening) {
      return {
        icon: <Mic className="w-4 h-4 animate-pulse" />,
        text: 'Listening...',
        color: 'text-red-500 dark:text-red-400'
      };
    }
    if (isThinking) {
      return {
        icon: <Brain className="w-4 h-4 animate-pulse" />,
        text: 'AI Thinking...',
        color: 'text-blue-500 dark:text-blue-400'
      };
    }
    if (isSpeaking) {
      return {
        icon: <Volume2 className="w-4 h-4 animate-pulse" />,
        text: 'Speaking...',
        color: 'text-purple-500 dark:text-purple-400'
      };
    }
    return null;
  };
  const systemStatus = getSystemStatus();
  const currentActivity = getCurrentActivity();
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm',
      className
    )}>
      {}
      <div className="flex items-center space-x-4">
        {}
        <div className="flex items-center space-x-2">
          <div className={cn('flex items-center space-x-1', getStatusColor(systemStatus))}>
            {getStatusIcon(systemStatus)}
            <span className="font-medium">
              {systemStatus === 'healthy' ? 'Connected' : 
               systemStatus === 'warning' ? 'Warning' :
               systemStatus === 'error' ? 'Error' : 'Offline'}
            </span>
          </div>
          {}
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            {modelHealth.modelName}
          </span>
        </div>
        {}
        {currentActivity && (
          <>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
            <div className={cn('flex items-center space-x-1', currentActivity.color)}>
              {currentActivity.icon}
              <span className="font-medium">{currentActivity.text}</span>
            </div>
          </>
        )}
      </div>
      {}
      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
        {modelHealth.lastSuccessfulCheck && (
          <div className="flex items-center space-x-1">
            <Activity className="w-3 h-3" />
            <span>
              Last sync: {new Date(modelHealth.lastSuccessfulCheck).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}
      </div>
      {}
      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {currentTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};
export default StatusBar;
