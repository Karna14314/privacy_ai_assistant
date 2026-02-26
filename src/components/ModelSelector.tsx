import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Monitor, 
  Globe, 
  Zap, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ModelProvider, llmRouter } from '../core/agents/llmRouter';
import { geminiApi } from '../services/geminiApi';
interface ModelSelectorProps {
  className?: string;
  onProviderChange?: (provider: ModelProvider) => void;
}
interface ConnectivityInfo {
  isOnline: boolean;
  latency: number;
  geminiReachable: boolean;
  lastCheck: Date;
}
interface ModelOption {
  provider: ModelProvider;
  name: string;
  description: string;
  icon: any;
  estimatedTime: number;
  available: boolean;
  reason?: string;
}
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  className,
  onProviderChange
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>(
    llmRouter.getCurrentProvider()
  );
  const [connectivity, setConnectivity] = useState<ConnectivityInfo>({
    isOnline: false,
    latency: 0,
    geminiReachable: false,
    lastCheck: new Date()
  });
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const updateConnectivity = async () => {
    const status = llmRouter.getConnectivityStatus();
    setConnectivity({
      isOnline: status.isOnline,
      latency: status.latency,
      geminiReachable: status.geminiApiReachable,
      lastCheck: status.lastCheck
    });
  };
  const testConnectivity = async () => {
    setIsTestingConnectivity(true);
    try {
      await geminiApi.testConnectivity();
      await updateConnectivity();
    } catch (error) {
      console.error('Connectivity test failed:', error);
    } finally {
      setIsTestingConnectivity(false);
    }
  };
  const handleProviderChange = (provider: ModelProvider) => {
    setSelectedProvider(provider);
    llmRouter.setProvider(provider);
    onProviderChange?.(provider);
    console.log(` [Model Selector] Provider changed to: ${provider}`);
  };
  useEffect(() => {
    updateConnectivity();
    const interval = setInterval(updateConnectivity, 10000);
    return () => clearInterval(interval);
  }, []);
  const modelOptions: ModelOption[] = [
    {
      provider: ModelProvider.LOCAL_GEMMA3N,
      name: 'Local Only (gemma3n)',
      description: 'Privacy-first local processing',
      icon: Monitor,
      estimatedTime: 800,
      available: true,
      reason: 'Always available offline'
    },
    {
      provider: ModelProvider.ONLINE_GEMINI,
      name: 'Online Only (Gemini)',
      description: 'Cloud-powered responses',
      icon: Globe,
      estimatedTime: connectivity.isOnline ? 1500 + connectivity.latency : 0,
      available: connectivity.isOnline && connectivity.geminiReachable,
      reason: connectivity.isOnline 
        ? connectivity.geminiReachable 
          ? `Available (${connectivity.latency}ms latency)`
          : 'Gemini API unreachable'
        : 'No internet connection'
    },
    {
      provider: ModelProvider.HYBRID_AUTO,
      name: 'Hybrid Auto',
      description: 'Smart routing based on complexity',
      icon: Zap,
      estimatedTime: connectivity.isOnline && connectivity.geminiReachable ? 1200 : 800,
      available: true,
      reason: connectivity.isOnline && connectivity.geminiReachable
        ? 'Online + Local available'
        : 'Local fallback available'
    }
  ];
  return (
    <div className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative z-10', className)}>
      {}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Model Selection
        </h3>
        {}
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
            connectivity.isOnline
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          )}>
            {connectivity.isOnline ? (
              <Wifi size={12} />
            ) : (
              <WifiOff size={12} />
            )}
            <span>
              {connectivity.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            onClick={testConnectivity}
            disabled={isTestingConnectivity}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Test connectivity"
          >
            {isTestingConnectivity ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Clock size={14} />
            )}
          </button>
        </div>
      </div>
      {}
      <div className="space-y-3">
        {modelOptions.map((option) => {
          const isSelected = selectedProvider === option.provider;
          const IconComponent = option.icon;
          return (
            <div
              key={option.provider}
              className={cn(
                'relative p-3 border rounded-lg cursor-pointer transition-all duration-200',
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                !option.available && 'opacity-60 cursor-not-allowed'
              )}
              onClick={() => option.available && handleProviderChange(option.provider)}
            >
              {}
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5',
                  isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                {}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <IconComponent size={16} className={cn(
                      isSelected ? 'text-blue-600' : 'text-gray-500'
                    )} />
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {option.name}
                    </span>
                    {}
                    {option.available ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : (
                      <AlertCircle size={14} className="text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {option.description}
                  </p>
                  {}
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                      option.available ? 'text-green-600' : 'text-red-600'
                    )}>
                      {option.reason}
                    </span>
                    {option.available && (
                      <span className="text-gray-500">
                        ~{option.estimatedTime}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between mb-1">
            <span>Last connectivity check:</span>
            <span>{connectivity.lastCheck.toLocaleTimeString()}</span>
          </div>
          {connectivity.isOnline && (
            <div className="flex items-center justify-between">
              <span>Network latency:</span>
              <span className={cn(
                connectivity.latency < 1000 ? 'text-green-600' :
                connectivity.latency < 2000 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {connectivity.latency}ms
              </span>
            </div>
          )}
        </div>
      </div>
      {}
      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
        <div className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Active:</strong> {modelOptions.find(opt => opt.provider === selectedProvider)?.name}
        </div>
      </div>
    </div>
  );
};
export default ModelSelector;
