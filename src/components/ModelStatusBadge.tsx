import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { ModelHealthStatus, modelHealthChecker } from '../utils/modelHealth';
interface ModelStatusBadgeProps {
  status: ModelHealthStatus;
  className?: string;
  showDetails?: boolean;
  onRefresh?: () => void;
}
export const ModelStatusBadge: React.FC<ModelStatusBadgeProps> = ({
  status,
  className = '',
  showDetails = false,
  onRefresh
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const getStatusConfig = () => {
    switch (status.connectionState) {
      case 'checking':
        return {
          icon: Loader2,
          label: 'Checking...',
          color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
          animate: 'animate-spin'
        };
      case 'connected':
        return {
          icon: CheckCircle,
          label: `${status.modelName} Connected`,
          color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800',
          animate: ''
        };
      case 'disconnected':
        return {
          icon: AlertCircle,
          label: `${status.modelName} Disconnected`,
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800',
          animate: ''
        };
      case 'error':
      default:
        return {
          icon: AlertCircle,
          label: 'Connection Error',
          color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800',
          animate: ''
        };
    }
  };
  const config = getStatusConfig();
  const Icon = config.icon;
  const detailedStatus = modelHealthChecker.getDetailedStatus();
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      modelHealthChecker.forceCheck();
    }
  };
  return (
    <div className="relative">
      <div
        className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md',
          config.color,
          className
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleRefresh}
        title="Click to refresh status"
      >
        <Icon className={cn('w-3 h-3 mr-1.5', config.animate)} />
        {config.label}
        {}
        <RefreshCw className={cn(
          'w-3 h-3 ml-1.5 opacity-50 hover:opacity-100 transition-opacity',
          status.isChecking && 'animate-spin'
        )} />
        {status.lastChecked && showDetails && (
          <span className="ml-1 opacity-75">
            • {new Date(status.lastChecked).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>
      {}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-lg z-50 min-w-64">
          <div className="font-medium mb-1">{detailedStatus.statusText}</div>
          {detailedStatus.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-gray-300 dark:text-gray-600">Recommendations:</div>
              {detailedStatus.recommendations.map((rec, index) => (
                <div key={index} className="text-gray-300 dark:text-gray-600">• {rec}</div>
              ))}
            </div>
          )}
          {status.lastSuccessfulCheck && (
            <div className="mt-2 text-gray-400 dark:text-gray-500 text-xs">
              Last successful: {new Date(status.lastSuccessfulCheck).toLocaleString()}
            </div>
          )}
          {}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
        </div>
      )}
    </div>
  );
};
export default ModelStatusBadge;
