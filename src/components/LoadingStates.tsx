import React from 'react';
import { Loader2, Brain, Cpu, Zap, AlertCircle } from 'lucide-react';
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${className}`} 
    />
  );
};
interface FullScreenLoadingProps {
  message?: string;
  submessage?: string;
  icon?: React.ReactNode;
}
export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  message = 'Loading...',
  submessage,
  icon
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {icon || <LoadingSpinner size="lg" className="text-blue-600" />}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {message}
        </h2>
        {submessage && (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {submessage}
          </p>
        )}
      </div>
    </div>
  );
};
export const AppInitializingLoader: React.FC = () => {
  return (
    <FullScreenLoading
      message="Initializing Privacy AI Assistant"
      submessage="Setting up your secure AI environment..."
      icon={<Brain className="w-12 h-12 text-blue-600 animate-pulse" />}
    />
  );
};
export const DiagnosticsLoader: React.FC = () => {
  return (
    <FullScreenLoading
      message="Running System Diagnostics"
      submessage="Checking hardware compatibility and model availability..."
      icon={<Cpu className="w-12 h-12 text-green-600 animate-pulse" />}
    />
  );
};
export const ModelLoadingLoader: React.FC<{ modelName?: string }> = ({ modelName }) => {
  return (
    <FullScreenLoading
      message="Loading AI Model"
      submessage={modelName ? `Preparing ${modelName}...` : "This may take a moment..."}
      icon={<Zap className="w-12 h-12 text-yellow-600 animate-pulse" />}
    />
  );
};
interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'md';
  className?: string;
}
export const InlineLoading: React.FC<InlineLoadingProps> = ({
  message = 'Loading...',
  size = 'sm',
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <LoadingSpinner size={size} className="text-blue-600" />
      <span className="text-gray-600 dark:text-gray-400 text-sm">
        {message}
      </span>
    </div>
  );
};
interface MessageLoadingProps {
  className?: string;
}
export const MessageLoading: React.FC<MessageLoadingProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 p-3 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-gray-500 dark:text-gray-400 text-sm">
        AI is thinking...
      </span>
    </div>
  );
};
interface ConnectionLoadingProps {
  service: string;
  className?: string;
}
export const ConnectionLoading: React.FC<ConnectionLoadingProps> = ({ 
  service, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-blue-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Connecting to {service}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Please wait while we establish a connection...
        </p>
      </div>
    </div>
  );
};
interface RetryableLoadingProps {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}
export const RetryableLoading: React.FC<RetryableLoadingProps> = ({
  message,
  onRetry,
  isRetrying = false,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="text-center">
        {isRetrying ? (
          <LoadingSpinner size="lg" className="text-blue-600 mb-4" />
        ) : (
          <AlertCircle className="w-12 h-12 text-orange-500 mb-4" />
        )}
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {message}
        </h3>
        {!isRetrying && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
        {isRetrying && (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Retrying...
          </p>
        )}
      </div>
    </div>
  );
};
