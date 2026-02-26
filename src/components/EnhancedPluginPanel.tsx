import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import {
  Package,
  Settings,
  Power,
  PowerOff,
  Info,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  FileText,
  FolderOpen,
  Eye,
  Zap,
  Globe,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../stores/chatStore';
import { EnhancedPluginManifest, PluginState } from '../types';
import ToolDashboard from './ToolDashboard';
interface PluginCardProps {
  pluginId: string;
  manifest: EnhancedPluginManifest;
  state: PluginState;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onConfigure: (pluginId: string) => void;
  onRemove: (pluginId: string) => void;
  onOpenDashboard: (pluginId: string) => void;
}
const PluginCard: React.FC<PluginCardProps> = ({
  pluginId,
  manifest,
  state,
  onToggle,
  onConfigure,
  onRemove,
  onOpenDashboard
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const getPluginIcon = (pluginId: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      todoList: CheckSquare,
      noteTaker: FileText,
      fileReader: FolderOpen,
      fileWriter: FileText,
      pluginInspector: Eye,
      devDiagnostics: Zap,
      webBrowser: Globe
    };
    return iconMap[pluginId] || Package;
  };
  const IconComponent = getPluginIcon(pluginId);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={cn(
            "p-2 rounded-lg",
            state.enabled ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-700"
          )}>
            <IconComponent 
              size={20} 
              className={cn(
                state.enabled ? manifest.ui.color : "text-gray-500 dark:text-gray-400"
              )}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {manifest.name}
              </h3>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                v{manifest.version}
              </span>
              {state.enabled && (
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {manifest.description}
            </p>
            {}
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Used {state.usageCount} times</span>
              {state.lastUsed && (
                <span>Last used: {new Date(state.lastUsed).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
            title="Show details"
          >
            {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button
            type="button"
            onClick={() => onToggle(pluginId, !state.enabled)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              state.enabled
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
            title={state.enabled ? "Disable plugin" : "Enable plugin"}
          >
            {state.enabled ? <Power size={16} /> : <PowerOff size={16} />}
          </button>
        </div>
      </div>
      {}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Trigger Words</h4>
              <div className="flex flex-wrap gap-1">
                {manifest.triggerWords.map((word) => (
                  <span
                    key={word}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Category</h4>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs capitalize">
                {manifest.category}
              </span>
            </div>
            {manifest.examples && manifest.examples.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Examples</h4>
                <div className="space-y-1">
                  {manifest.examples.slice(0, 3).map((example, index) => (
                    <div key={index} className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={() => onOpenDashboard(pluginId)}
              className="flex items-center space-x-1 px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              disabled={!state.enabled}
            >
              <ExternalLink size={12} />
              <span>Open Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => onConfigure(pluginId)}
              className="flex items-center space-x-1 px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Settings size={12} />
              <span>Configure</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(pluginId)}
              className="flex items-center space-x-1 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
interface EnhancedPluginPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
const EnhancedPluginPanel: React.FC<EnhancedPluginPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [plugins, setPlugins] = useState<Record<string, { manifest: EnhancedPluginManifest; state: PluginState }>>({});
  const [showToolDashboard, setShowToolDashboard] = useState(false);
  const [selectedTool, setSelectedTool] = useState<{ id: string; manifest: EnhancedPluginManifest } | null>(null);
  const { pluginsEnabled, setPluginsEnabled } = useAppStore();
  useEffect(() => {
    const mockPlugins = {
      todoList: {
        manifest: {
          name: 'Todo List Manager',
          description: 'Create and manage todo lists with smart categorization',
          version: '1.2.0',
          author: 'AI Assistant Team',
          keywords: ['todo', 'task', 'productivity'],
          triggerWords: ['todo', 'task', 'remind', 'list'],
          category: 'productivity' as const,
          permissions: ['storage'],
          examples: [
            'Add "Buy groceries" to my todo list',
            'Show my pending tasks',
            'Mark task as complete'
          ],
          ui: {
            icon: 'check-square',
            color: 'text-blue-600',
            position: 1,
            showInSidebar: true,
            showInToolbar: true
          }
        },
        state: {
          enabled: true,
          data: { tasks: [] },
          lastUsed: new Date('2024-01-15'),
          usageCount: 23
        }
      },
      noteTaker: {
        manifest: {
          name: 'Smart Note Taker',
          description: 'Capture and organize notes with AI-powered categorization',
          version: '1.1.0',
          author: 'AI Assistant Team',
          keywords: ['note', 'memo', 'write'],
          triggerWords: ['note', 'memo', 'write', 'save'],
          category: 'productivity' as const,
          permissions: ['storage', 'filesystem'],
          examples: [
            'Take a note about the meeting',
            'Save this idea for later',
            'Show my recent notes'
          ],
          ui: {
            icon: 'file-text',
            color: 'text-green-600',
            position: 2,
            showInSidebar: true,
            showInToolbar: true
          }
        },
        state: {
          enabled: true,
          data: { notes: [] },
          lastUsed: new Date('2024-01-14'),
          usageCount: 15
        }
      },
      fileReader: {
        manifest: {
          name: 'File Reader',
          description: 'Read and analyze various file formats',
          version: '1.0.5',
          author: 'AI Assistant Team',
          keywords: ['file', 'read', 'analyze'],
          triggerWords: ['read', 'file', 'analyze', 'open'],
          category: 'file' as const,
          permissions: ['filesystem'],
          examples: [
            'Read the contents of document.txt',
            'Analyze this CSV file',
            'What\'s in this PDF?'
          ],
          ui: {
            icon: 'folder-open',
            color: 'text-yellow-600',
            position: 3,
            showInSidebar: true,
            showInToolbar: false
          }
        },
        state: {
          enabled: false,
          data: {},
          lastUsed: new Date('2024-01-10'),
          usageCount: 8
        }
      }
    };
    setPlugins(mockPlugins);
  }, []);
  const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
    setPlugins(prev => ({
      ...prev,
      [pluginId]: {
        ...prev[pluginId],
        state: {
          ...prev[pluginId].state,
          enabled
        }
      }
    }));
  };
  const handleConfigurePlugin = (pluginId: string) => {
    console.log('Configure plugin:', pluginId);
  };
  const handleOpenDashboard = (pluginId: string) => {
    const plugin = plugins[pluginId];
    if (plugin && plugin.state.enabled) {
      setSelectedTool({ id: pluginId, manifest: plugin.manifest });
      setShowToolDashboard(true);
      console.log('Opening dashboard for plugin:', pluginId);
    }
  };
  const handleRemovePlugin = (pluginId: string) => {
    if (window.confirm(`Are you sure you want to remove the ${plugins[pluginId].manifest.name} plugin?`)) {
      setPlugins(prev => {
        const { [pluginId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };
  const handleRefreshPlugins = () => {
    console.log('Refreshing plugins...');
  };
  const handleInstallPlugin = () => {
    console.log('Install new plugin...');
  };
  const filteredPlugins = Object.entries(plugins).filter(([pluginId, { manifest, state }]) => {
    const matchesSearch = searchQuery === '' || 
      manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manifest.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manifest.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || manifest.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'enabled' && state.enabled) ||
      (statusFilter === 'disabled' && !state.enabled);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const categories = ['all', 'productivity', 'utility', 'system', 'file', 'other'];
  const statuses = ['all', 'enabled', 'disabled'];
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Package className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Plugin Manager
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Plugins</span>
              <button
                type="button"
                onClick={() => setPluginsEnabled(!pluginsEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  pluginsEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    pluginsEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            {}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {}
            <div className="flex space-x-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleRefreshPlugins}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleInstallPlugin}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                <span>Install</span>
              </button>
            </div>
          </div>
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredPlugins.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No plugins found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Install your first plugin to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPlugins.map(([pluginId, { manifest, state }]) => (
                <PluginCard
                  key={pluginId}
                  pluginId={pluginId}
                  manifest={manifest}
                  state={state}
                  onToggle={handleTogglePlugin}
                  onConfigure={handleConfigurePlugin}
                  onRemove={handleRemovePlugin}
                  onOpenDashboard={handleOpenDashboard}
                />
              ))}
            </div>
          )}
        </div>
        {}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              {filteredPlugins.length} of {Object.keys(plugins).length} plugins shown
            </span>
            <span>
              {Object.values(plugins).filter(p => p.state.enabled).length} enabled
            </span>
          </div>
        </div>
      </div>
      {}
      {showToolDashboard && selectedTool && (
        <ToolDashboard
          toolName={selectedTool.manifest.name}
          toolIcon={(() => {
            const iconMap: Record<string, React.ComponentType<any>> = {
              todoList: CheckSquare,
              noteTaker: FileText,
              fileReader: FolderOpen,
              fileWriter: FileText,
              pluginInspector: Eye,
              devDiagnostics: Zap,
              webBrowser: Globe
            };
            return iconMap[selectedTool.id] || Package;
          })()}
          toolColor={selectedTool.manifest.ui?.color || 'text-blue-600'}
          description={selectedTool.manifest.description}
          onClose={() => {
            setShowToolDashboard(false);
            setSelectedTool(null);
          }}
          onExecute={async (data) => {
            const toolContext = {
              toolName: selectedTool.manifest.name,
              toolId: selectedTool.id,
              data: data.toolData,
              context: data.context,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem('toolContext', JSON.stringify(toolContext));
            console.log('Tool executed with context:', toolContext);
            return { success: true, message: 'Tool context saved for LLM integration' };
          }}
        />
      )}
    </div>
  );
};
export default EnhancedPluginPanel;
