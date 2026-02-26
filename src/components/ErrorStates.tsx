import React from 'react';
import {
  AlertTriangle,
  Wifi,
  Server,
  Brain,
  RefreshCw,
  Settings,
  Copy,
  Bug
} from 'lucide-react';
interface BaseErrorProps {
  title: string;
  message: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}
const BaseError: React.FC<BaseErrorProps> = ({
  title,
  message,
  actions,
  icon,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="mb-6">
        {icon || <AlertTriangle className="w-16 h-16 text-red-500" />}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {message}
      </p>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-3">
          {actions}
        </div>
      )}
    </div>
  );
};
interface ConnectionErrorProps {
  service: string;
  onRetry?: () => void;
  onSettings?: () => void;
  className?: string;
}
export const ConnectionError: React.FC<ConnectionErrorProps> = ({
  service,
  onRetry,
  onSettings,
  className = ''
}) => {
  const actions = (
    <>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      )}
      {onSettings && (
        <button
          onClick={onSettings}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      )}
    </>
  );
  return (
    <BaseError
      title="Connection Failed"
      message={`Unable to connect to ${service}. Please check your connection and try again.`}
      icon={<Wifi className="w-16 h-16 text-red-500" />}
      actions={actions}
      className={className}
    />
  );
};
interface ModelErrorProps {
  modelName?: string;
  error?: string;
  onRetry?: () => void;
  onChangeModel?: () => void;
  className?: string;
}
export const ModelError: React.FC<ModelErrorProps> = ({
  modelName,
  error,
  onRetry,
  onChangeModel,
  className = ''
}) => {
  const actions = (
    <>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      )}
      {onChangeModel && (
        <button
          onClick={onChangeModel}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
        >
          <Brain className="w-4 h-4" />
          <span>Change Model</span>
        </button>
      )}
    </>
  );
  return (
    <BaseError
      title="Model Error"
      message={
        modelName 
          ? `Failed to load or use model "${modelName}". ${error || 'Please try again or select a different model.'}`
          : `AI model error occurred. ${error || 'Please try again.'}`
      }
      icon={<Brain className="w-16 h-16 text-red-500" />}
      actions={actions}
      className={className}
    />
  );
};
interface ServerErrorProps {
  onRetry?: () => void;
  onRestart?: () => void;
  className?: string;
}
export const ServerError: React.FC<ServerErrorProps> = ({
  onRetry,
  onRestart,
  className = ''
}) => {
  const actions = (
    <>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      )}
      {onRestart && (
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <Server className="w-4 h-4" />
          <span>Restart Server</span>
        </button>
      )}
    </>
  );
  return (
    <BaseError
      title="Server Error"
      message="The backend server encountered an error. Please try again or restart the server."
      icon={<Server className="w-16 h-16 text-red-500" />}
      actions={actions}
      className={className}
    />
  );
};
interface DetailedErrorProps {
  title: string;
  message: string;
  details?: string;
  errorId?: string;
  onRetry?: () => void;
  onReport?: () => void;
  className?: string;
}
export const DetailedError: React.FC<DetailedErrorProps> = ({
  title,
  message,
  details,
  errorId,
  onRetry,
  onReport,
  className = ''
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const copyErrorDetails = () => {
    const errorText = `
Error: ${title}
Message: ${message}
${details ? `Details: ${details}` : ''}
${errorId ? `Error ID: ${errorId}` : ''}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();
    navigator.clipboard.writeText(errorText).then(() => {
      alert('Error details copied to clipboard!');
    }).catch(() => {
      console.warn('Failed to copy to clipboard');
    });
  };
  const actions = (
    <>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      )}
      <button
        onClick={copyErrorDetails}
        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
      >
        <Copy className="w-4 h-4" />
        <span>Copy Details</span>
      </button>
      {onReport && (
        <button
          onClick={onReport}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
        >
          <Bug className="w-4 h-4" />
          <span>Report Issue</span>
        </button>
      )}
    </>
  );
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="mb-6">
        <AlertTriangle className="w-16 h-16 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {message}
      </p>
      {errorId && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Error ID: {errorId}
        </p>
      )}
      {details && (
        <div className="mb-6 w-full max-w-2xl">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-600 hover:text-blue-700 text-sm underline mb-2"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          {showDetails && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-left">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {details}
              </pre>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {actions}
      </div>
    </div>
  );
};
interface FullScreenErrorProps {
  title: string;
  message: string;
  onRetry?: () => void;
  onReload?: () => void;
  className?: string;
}
export const FullScreenError: React.FC<FullScreenErrorProps> = ({
  title,
  message,
  onRetry,
  onReload,
  className = ''
}) => {
  const handleReload = () => {
    if (onReload) {
      onReload();
    } else {
      window.location.reload();
    }
  };
  const actions = (
    <>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      )}
      <button
        onClick={handleReload}
        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Reload App
      </button>
    </>
  );
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <BaseError
        title={title}
        message={message}
        actions={actions}
        className="min-h-screen"
      />
    </div>
  );
};
