import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Brain, 
  Globe, 
  Mic, 
  Volume2, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toolMetricsService, ToolMetricsData } from '../services/toolMetricsService';
interface CapabilitiesStatusPanelProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}
interface CapabilityStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'active' | 'inactive' | 'ready' | 'listening' | 'processing' | 'speaking';
  icon: any;
  details?: string;
  lastUpdate?: Date;
  color: string;
}
export const CapabilitiesStatusPanel: React.FC<CapabilitiesStatusPanelProps> = ({
  className,
  isCollapsed = false,
  onToggle
}) => {
  const [capabilities, setCapabilities] = useState<CapabilityStatus[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toolMetrics, setToolMetrics] = useState<Map<string, ToolMetricsData>>(new Map());
  const initializeCapabilities = async () => {
    const initialCapabilities: CapabilityStatus[] = [
      {
        name: 'Dashboard Access',
        status: 'disconnected',
        icon: Database,
        details: 'Checking connection...',
        color: 'text-gray-500'
      },
      {
        name: 'Model Status',
        status: 'disconnected',
        icon: Brain,
        details: 'gemma3n Local',
        color: 'text-gray-500'
      },
      {
        name: 'Browser Integration',
        status: 'inactive',
        icon: Globe,
        details: 'Ready for web search',
        color: 'text-gray-500'
      },
      {
        name: 'Context Usage',
        status: 'ready',
        icon: Zap,
        details: '0 / 32,768 tokens',
        color: 'text-green-500'
      },
      {
        name: 'Voice Chat',
        status: 'ready',
        icon: Mic,
        details: 'Ready for voice input',
        color: 'text-green-500'
      }
    ];
    setCapabilities(initialCapabilities);
    await updateCapabilities();
  };
  const updateCapabilities = async () => {
    setIsRefreshing(true);
    try {
      const dashboardStatus = await checkDashboardAccess();
      const modelStatus = await checkModelStatus();
      const browserStatus = await checkBrowserIntegration();
      const contextStatus = await checkContextUsage();
      const voiceStatus = await checkVoiceChat();
      setCapabilities([
        {
          name: 'Dashboard Access',
          status: dashboardStatus.connected ? 'connected' : 'disconnected',
          icon: Database,
          details: dashboardStatus.details,
          lastUpdate: new Date(),
          color: dashboardStatus.connected ? 'text-green-500' : 'text-red-500'
        },
        {
          name: 'Model Status',
          status: modelStatus.connected ? 'connected' : 'disconnected',
          icon: Brain,
          details: modelStatus.details,
          lastUpdate: new Date(),
          color: modelStatus.connected ? 'text-green-500' : 'text-red-500'
        },
        {
          name: 'Browser Integration',
          status: browserStatus.active ? 'active' : 'inactive',
          icon: Globe,
          details: browserStatus.details,
          lastUpdate: new Date(),
          color: browserStatus.active ? 'text-blue-500' : 'text-gray-500'
        },
        {
          name: 'Context Usage',
          status: 'ready',
          icon: Zap,
          details: contextStatus.details,
          lastUpdate: new Date(),
          color: contextStatus.color
        },
        {
          name: 'Voice Chat',
          status: voiceStatus.status,
          icon: voiceStatus.status === 'speaking' ? Volume2 : Mic,
          details: voiceStatus.details,
          lastUpdate: new Date(),
          color: voiceStatus.color
        }
      ]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to update capabilities:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  const checkDashboardAccess = async () => {
    try {
      await invoke('get_hardware_metrics');
      return { connected: true, details: 'Hardware metrics available' };
    } catch (error) {
      return { connected: false, details: 'Dashboard unavailable' };
    }
  };
  const checkModelStatus = async () => {
    try {
      const status = await invoke('check_llm_health');
      return { 
        connected: true, 
        details: 'gemma3n:latest Connected' 
      };
    } catch (error) {
      return { 
        connected: false, 
        details: 'gemma3n:latest Disconnected' 
      };
    }
  };
  const checkBrowserIntegration = async () => {
    const browserActive = document.querySelector('[data-browser-active]') !== null;
    return {
      active: browserActive,
      details: browserActive ? 'Browser panel active' : 'Browser ready'
    };
  };
  const checkContextUsage = async () => {
    const tokenCount = parseInt(localStorage.getItem('tokenCount') || '0');
    const maxTokens = 32768;
    const percentage = (tokenCount / maxTokens) * 100;
    let color = 'text-green-500';
    if (percentage >= 90) color = 'text-red-500';
    else if (percentage >= 70) color = 'text-yellow-500';
    return {
      details: `${tokenCount.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${Math.round(percentage)}%)`,
      color
    };
  };
  const checkVoiceChat = async () => {
    const voiceStatus = localStorage.getItem('voiceStatus') || 'ready';
    const statusMap = {
      ready: { status: 'ready' as const, details: 'Ready for voice input', color: 'text-green-500' },
      listening: { status: 'listening' as const, details: 'Listening...', color: 'text-blue-500' },
      processing: { status: 'processing' as const, details: 'Processing speech...', color: 'text-yellow-500' },
      speaking: { status: 'speaking' as const, details: 'Speaking response...', color: 'text-purple-500' }
    };
    return statusMap[voiceStatus as keyof typeof statusMap] || statusMap.ready;
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
      case 'ready':
        return <CheckCircle size={12} className="text-green-500" />;
      case 'disconnected':
      case 'inactive':
        return <XCircle size={12} className="text-red-500" />;
      case 'listening':
        return <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />;
      case 'processing':
        return <RefreshCw size={12} className="text-yellow-500 animate-spin" />;
      case 'speaking':
        return <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" />;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };
  useEffect(() => {
    initializeCapabilities();
    const interval = setInterval(updateCapabilities, 2000);
    const unsubscribeMetrics = toolMetricsService.subscribe((metrics) => {
      setToolMetrics(metrics);
    });
    const setupEventListeners = async () => {
      try {
        await listen('capability-status-update', (event: any) => {
          console.log('Capability status update:', event.payload);
          updateCapabilities();
        });
      } catch (error) {
        console.warn('Failed to setup event listeners:', error);
      }
    };
    setupEventListeners();
    return () => {
      clearInterval(interval);
      unsubscribeMetrics();
    };
  }, []);
  return (
    <div className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      {}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-blue-600" />
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
            System Capabilities
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateCapabilities();
            }}
            disabled={isRefreshing}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Refresh status"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          {onToggle && (
            isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />
          )}
        </div>
      </div>
      {}
      {!isCollapsed && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {}
          <div className="p-3 space-y-3">
            {capabilities.map((capability, index) => {
              const IconComponent = capability.icon;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <IconComponent size={16} className={capability.color} />
                      {getStatusIcon(capability.status)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {capability.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {capability.details}
                      </div>
                    </div>
                  </div>
                  {capability.lastUpdate && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {capability.lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-1">
                {navigator.onLine ? (
                  <>
                    <Wifi size={12} className="text-green-500" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} className="text-red-500" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CapabilitiesStatusPanel;
